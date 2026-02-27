"""Coder agent — generates and optionally executes Python code in a sandboxed container."""

import uuid
from datetime import datetime
from typing import Any

from app.agents.base import BaseAgent
from app.config import get_settings
from app.models.task import AgentStatus, HITLReviewRecord
from app.tools.registry import ToolPermission

SYSTEM_PROMPT = """You are a Coder agent. Your job is to write correct, efficient Python code
that solves the given programming task.

Respond ONLY with a JSON object:
{
  "code": "# Python code here",
  "explanation": "Brief explanation of what the code does",
  "language": "python",
  "execute": true
}

Set execute=false if the code should NOT be run automatically (e.g., it modifies files/system).
"""


class CoderAgent(BaseAgent):
    agent_type = "coder"
    granted_permissions = [ToolPermission.read, ToolPermission.execute]

    async def run(self, context: dict[str, Any]) -> dict[str, Any]:
        self._set_status(AgentStatus.running)
        task = context.get("task", context.get("objective", ""))

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Programming task: {task}"},
        ]

        raw_response = await self.llm.chat(messages, temperature=0.2)
        confidence = self._estimate_confidence(raw_response)

        import json, re
        code_result: dict[str, Any] = {}
        try:
            json_match = re.search(r"\{.*\}", raw_response, re.DOTALL)
            if json_match:
                code_result = json.loads(json_match.group())
        except (json.JSONDecodeError, AttributeError):
            code_result = {"code": raw_response, "explanation": "", "language": "python", "execute": False}

        settings = get_settings()
        should_execute = code_result.get("execute", False)
        execution_result = None

        if should_execute and confidence < settings.hitl_confidence_threshold:
            self._set_status(AgentStatus.waiting_hitl)
            review_id = await self._save_hitl_review(
                action="execute_code",
                payload={"code": code_result.get("code", ""), "language": "python"},
                confidence=confidence,
                reason=f"Confidence {confidence:.0%} is below threshold {settings.hitl_confidence_threshold:.0%}. Code execution requires human approval.",
            )
            self._log.info("hitl_required", confidence=confidence, review_id=review_id)
            return {
                "agent_id": self.agent_id,
                "agent_type": self.agent_type,
                "status": "waiting_hitl",
                "review_id": str(review_id),
                "code": code_result.get("code", ""),
                "confidence": confidence,
            }

        if should_execute:
            try:
                execution_result = await self.use_tool(
                    "run_code",
                    code=code_result.get("code", ""),
                    language="python",
                )
            except Exception as exc:
                execution_result = {"success": False, "stderr": str(exc), "stdout": "", "exit_code": -1}

        self._set_status(AgentStatus.completed)
        return {
            "agent_id": self.agent_id,
            "agent_type": self.agent_type,
            "code": code_result.get("code", ""),
            "explanation": code_result.get("explanation", ""),
            "execution_result": execution_result,
            "confidence": confidence,
        }

    async def _save_hitl_review(
        self,
        action: str,
        payload: dict[str, Any],
        confidence: float,
        reason: str,
    ) -> str:
        """Persist the HITL review to PostgreSQL so the queue endpoint can serve it."""
        from app.memory.relational import get_session_factory
        from app.messaging.bus import bus

        review_id = uuid.uuid4()
        factory = get_session_factory()
        async with factory() as db:
            record = HITLReviewRecord(
                id=review_id,
                task_id=uuid.UUID(self.task_id) if isinstance(self.task_id, str) else self.task_id,
                agent_id=self.agent_id,
                action=action,
                payload=payload,
                confidence=str(round(confidence, 4)),
                reason=reason,
                status="pending",
            )
            db.add(record)
            await db.commit()

        await bus.publish_event({
            "event": "hitl_required",
            "task_id": self.task_id,
            "agent_id": self.agent_id,
            "review_id": str(review_id),
            "reason": reason,
            "confidence": confidence,
            "timestamp": datetime.utcnow().isoformat(),
        })
        return review_id
