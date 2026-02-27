import asyncio
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.memory.relational import get_db
from app.models.task import TaskCreate, TaskRecord, TaskResponse, TaskStatus
from app.orchestrator import orchestrator

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def _serialize_task(record: TaskRecord) -> dict[str, Any]:
    snapshot = record.dag_snapshot or {}
    return {
        "task_id": str(record.id),
        "objective": record.objective,
        "priority": record.priority,
        "status": record.status,
        "tags": record.tags or [],
        "dag_nodes": snapshot.get("nodes", []),
        "dag_edges": snapshot.get("edges", []),
        "result": record.result,
        "error": record.error,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }


@router.post("/", status_code=status.HTTP_202_ACCEPTED, response_model=TaskResponse)
async def create_task(
    payload: TaskCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    task_id = str(uuid.uuid4())
    record = TaskRecord(
        id=task_id,
        objective=payload.objective,
        priority=payload.priority,
        status=TaskStatus.pending,
        tags=payload.tags,
        context=payload.context,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    background_tasks.add_task(
        orchestrator.submit_task,
        task_id=task_id,
        objective=payload.objective,
        priority=payload.priority,
        tags=payload.tags,
        context=payload.context,
    )

    return _serialize_task(record)


@router.get("/", response_model=list[TaskResponse])
async def list_tasks(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TaskRecord).order_by(TaskRecord.created_at.desc()).limit(limit).offset(offset)
    )
    records = result.scalars().all()
    return [_serialize_task(r) for r in records]


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TaskRecord).where(TaskRecord.id == task_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Task not found.")
    return _serialize_task(record)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_task(task_id: str, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import update
    from datetime import datetime

    result = await db.execute(select(TaskRecord).where(TaskRecord.id == task_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Task not found.")
    if record.status in (TaskStatus.completed, TaskStatus.failed, TaskStatus.cancelled):
        raise HTTPException(status_code=400, detail=f"Cannot cancel task in status '{record.status}'.")

    await db.execute(
        update(TaskRecord)
        .where(TaskRecord.id == task_id)
        .values(status=TaskStatus.cancelled, updated_at=datetime.utcnow())
    )
    await db.commit()
