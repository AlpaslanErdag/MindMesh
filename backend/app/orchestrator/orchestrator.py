"""Central Orchestrator — routes tasks, manages the DAG lifecycle, and coordinates agents."""

import asyncio
import uuid
from datetime import datetime
from typing import Any

import structlog

from app.agents import AGENT_REGISTRY
from app.messaging.bus import STREAM_EVENTS, bus
from app.models.task import (
    AgentActionRecord,
    AgentStatus,
    TaskRecord,
    TaskStatus,
)
from app.orchestrator.dag import TaskDAG

logger = structlog.get_logger(__name__)

_active_dags: dict[str, TaskDAG] = {}


async def _get_db_session():
    from app.memory.relational import get_session_factory
    factory = get_session_factory()
    return factory()


async def _emit(event: str, task_id: str, **kwargs: Any) -> None:
    await bus.publish_event({
        "event": event,
        "task_id": task_id,
        "timestamp": datetime.utcnow().isoformat(),
        **kwargs,
    })


async def submit_task(
    task_id: str,
    objective: str,
    priority: str,
    tags: list[str],
    context: dict[str, Any],
) -> None:
    """Entry point called by FastAPI background task.
    Creates its own DB session — does NOT reuse the request session.
    """
    log = logger.bind(task_id=task_id)
    log.info("task_received", objective=objective[:80])

    async with await _get_db_session() as db:
        await _emit("task_started", task_id=task_id, message="Task alındı — planlama başlıyor.")
        await _update_task_status(task_id, TaskStatus.planning, db)

        planner_cls = AGENT_REGISTRY["planner"]
        planner = planner_cls(task_id=task_id)
        try:
            plan_result = await planner.run({"objective": objective, **context})
        except Exception as exc:
            log.error("planner_failed", error=str(exc))
            await _update_task_status(task_id, TaskStatus.failed, db, error=str(exc))
            return

        plan = plan_result.get("plan", [])
        if not plan:
            await _update_task_status(task_id, TaskStatus.failed, db, error="Planner adım üretemedi.")
            return

        dag = TaskDAG.from_plan(task_id, plan)
        _active_dags[task_id] = dag

        snapshot = dag.to_snapshot()
        await _update_task_status(task_id, TaskStatus.running, db, dag_snapshot=snapshot)
        await _emit("dag_initialized", task_id=task_id, dag=snapshot)

    await _execute_dag(task_id, dag, plan, objective, context)


async def _execute_dag(
    task_id: str,
    dag: TaskDAG,
    plan: list[dict[str, Any]],
    objective: str,
    context: dict[str, Any],
) -> None:
    log = logger.bind(task_id=task_id)
    step_map = {f"{s['agent_type']}-{int(s['step'])}": s for s in plan}
    agent_outputs: dict[str, Any] = {}

    while not dag.is_complete():
        ready_nodes = dag.get_ready_nodes()
        if not ready_nodes:
            await asyncio.sleep(0.5)
            continue

        tasks = [
            _run_agent_node(
                task_id=task_id,
                node_id=node_id,
                step=step_map.get(node_id, {}),
                objective=objective,
                context=context,
                agent_outputs=agent_outputs,
                dag=dag,
            )
            for node_id in ready_nodes
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for node_id, result in zip(ready_nodes, results):
            if isinstance(result, Exception):
                dag.set_node_status(node_id, AgentStatus.failed, message=str(result))
                log.error("agent_node_failed", node_id=node_id, error=str(result))
            else:
                agent_outputs[node_id] = result

        snapshot = dag.to_snapshot()

        async with await _get_db_session() as db:
            await _update_task_status(task_id, TaskStatus.running, db, dag_snapshot=snapshot)

        await _emit("dag_updated", task_id=task_id, dag=snapshot)

    final_status = TaskStatus.failed if dag.has_failures() else TaskStatus.completed

    async with await _get_db_session() as db:
        await _update_task_status(
            task_id,
            final_status,
            db,
            dag_snapshot=dag.to_snapshot(),
            result=agent_outputs,
        )

    await _emit("task_completed", task_id=task_id, status=final_status, message="Task tamamlandı.")
    _active_dags.pop(task_id, None)


async def _run_agent_node(
    task_id: str,
    node_id: str,
    step: dict[str, Any],
    objective: str,
    context: dict[str, Any],
    agent_outputs: dict[str, Any],
    dag: TaskDAG,
) -> dict[str, Any]:
    agent_type = step.get("agent_type", "researcher")

    # custom agent desteği için genişletilmiş arama
    agent_cls = AGENT_REGISTRY.get(agent_type)
    if not agent_cls:
        # custom agent'ları DB'den al
        agent_cls = await _resolve_custom_agent(agent_type)
    if not agent_cls:
        raise ValueError(f"Bilinmeyen agent tipi: {agent_type}")

    agent = agent_cls(task_id=task_id, node_id=node_id)
    dag.set_node_status(node_id, AgentStatus.running, message="Çalışıyor...")

    await _emit(
        "agent_state_update",
        task_id=task_id,
        agent_id=node_id,
        agent_type=agent_type,
        status="running",
        message="Çalışıyor...",
    )

    run_context = {
        "task": step.get("task", objective),
        "objective": objective,
        "prior_outputs": agent_outputs,
        **context,
    }

    result = await agent.run(run_context)
    confidence = result.get("confidence")

    dag.set_node_status(node_id, AgentStatus.completed, message="Tamamlandı.", confidence=confidence)

    await _emit(
        "agent_state_update",
        task_id=task_id,
        agent_id=node_id,
        agent_type=agent_type,
        status="completed",
        message="Tamamlandı.",
        confidence=confidence,
    )

    async with await _get_db_session() as db:
        await _record_action(task_id, node_id, agent_type, step.get("task", ""), run_context, result, db)

    return result


async def _resolve_custom_agent(agent_type: str):
    """DB'deki custom agent'ları ara ve DynamicAgent döndür."""
    try:
        from sqlalchemy import select
        from app.models.task import CustomAgentRecord
        from app.agents.dynamic import make_dynamic_agent

        async with await _get_db_session() as db:
            result = await db.execute(
                select(CustomAgentRecord).where(CustomAgentRecord.name == agent_type)
            )
            record = result.scalar_one_or_none()
            if record:
                return make_dynamic_agent(
                    name=record.name,
                    system_prompt=record.system_prompt,
                    description=record.description,
                )
    except Exception:
        pass
    return None


async def _record_action(
    task_id: str,
    agent_id: str,
    agent_type: str,
    action: str,
    input_data: dict,
    output_data: dict,
    db,
) -> None:
    record = AgentActionRecord(
        task_id=task_id,
        agent_id=agent_id,
        agent_type=agent_type,
        action=action[:100],
        input_data=input_data,
        output_data=output_data,
        status="completed",
        confidence=str(output_data.get("confidence", "")),
    )
    db.add(record)
    await db.commit()


async def _update_task_status(
    task_id: str,
    status: TaskStatus,
    db,
    dag_snapshot: dict | None = None,
    result: dict | None = None,
    error: str | None = None,
) -> None:
    from sqlalchemy import update

    values: dict[str, Any] = {
        "status": status,
        "updated_at": datetime.utcnow(),
    }
    if dag_snapshot is not None:
        values["dag_snapshot"] = dag_snapshot
    if result is not None:
        values["result"] = result
    if error is not None:
        values["error"] = error

    await db.execute(
        update(TaskRecord).where(TaskRecord.id == task_id).values(**values)
    )
    await db.commit()


def get_active_dag(task_id: str) -> TaskDAG | None:
    return _active_dags.get(task_id)
