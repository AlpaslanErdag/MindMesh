"""Critic agent — reviews and scores the output of other agents."""

from typing import Any

import structlog

from app.agents.base import BaseAgent
from app.models.task import AgentStatus
from app.tools.registry import ToolPermission

logger = structlog.get_logger(__name__)

SYSTEM_PROMPT = """You are a Critic agent. Your job is to rigorously review and evaluate
the work produced by other agents. You assess accuracy, completeness, and quality.

Respond ONLY with a JSON object:
{
  "score": 0 to 10,
  "verdict": "approved" | "needs_revision" | "rejected",
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1"],
  "recommendations": ["recommendation1"],
  "confidence": 0.0 to 1.0
}
"""


class CriticAgent(BaseAgent):
    agent_type = "critic"
    granted_permissions = [ToolPermission.read]

    async def run(self, context: dict[str, Any]) -> dict[str, Any]:
        self._set_status(AgentStatus.running)
        task = context.get("task", "Review the previous agent outputs.")
        prior_outputs = context.get("prior_outputs", {})

        prior_text = "\n\n".join(
            f"--- {agent_type} output ---\n{str(output)[:1000]}"
            for agent_type, output in prior_outputs.items()
        )

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Review task: {task}\n\nPrior agent outputs:\n{prior_text or 'No prior outputs.'}",
            },
        ]

        raw_response = await self.llm.chat(messages, temperature=0.3)
        confidence = self._estimate_confidence(raw_response)

        import json, re
        review = {}
        try:
            json_match = re.search(r"\{.*\}", raw_response, re.DOTALL)
            if json_match:
                review = json.loads(json_match.group())
        except (json.JSONDecodeError, AttributeError):
            review = {
                "score": 5,
                "verdict": "needs_revision",
                "strengths": [],
                "weaknesses": ["Could not parse structured review."],
                "recommendations": ["Re-run with more context."],
                "confidence": confidence,
            }

        self._set_status(AgentStatus.completed)
        return {
            "agent_id": self.agent_id,
            "agent_type": self.agent_type,
            **review,
            "confidence": review.get("confidence", confidence),
        }
