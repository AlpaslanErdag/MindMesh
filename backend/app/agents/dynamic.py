"""DynamicAgent — kullanıcının tanımladığı system prompt ile çalışan agent fabrikası.

make_dynamic_agent() ile agent sınıfı (class) üretilir, orchestrator bunu
tıpkı built-in agent'lar gibi instantiate eder.
"""

import json
import re
from typing import Any

from app.agents.base import BaseAgent
from app.models.task import AgentStatus
from app.tools.registry import ToolPermission


def make_dynamic_agent(name: str, system_prompt: str, description: str = "") -> type:
    """Verilen parametrelerle yeni bir agent sınıfı üretir ve döndürür."""

    class DynamicAgent(BaseAgent):
        agent_type = name
        granted_permissions = [ToolPermission.read, ToolPermission.network]
        _system_prompt = system_prompt
        _description = description

        async def run(self, context: dict[str, Any]) -> dict[str, Any]:
            self._set_status(AgentStatus.running)
            objective = context.get("objective", "")
            task = context.get("task", objective)
            prior_outputs = context.get("prior_outputs", {})

            prior_text = "\n\n".join(
                f"[{aid}]: {str(out)[:600]}"
                for aid, out in prior_outputs.items()
            ) if prior_outputs else ""

            user_content = f"Task: {task}"
            if prior_text:
                user_content += f"\n\nPrevious agent outputs:\n{prior_text}"

            messages = [
                {"role": "system", "content": self._system_prompt},
                {"role": "user", "content": user_content},
            ]

            raw_response = await self.llm.chat(messages, temperature=0.5)
            confidence = self._estimate_confidence(raw_response)

            result: dict[str, Any] = {}
            try:
                json_match = re.search(r"\{.*\}", raw_response, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group())
            except (json.JSONDecodeError, AttributeError):
                result = {"output": raw_response}

            self._set_status(AgentStatus.completed)
            return {
                "agent_id": self.agent_id,
                "agent_type": self.agent_type,
                **result,
                "raw_output": raw_response if not result else None,
                "confidence": result.get("confidence", confidence),
            }

    DynamicAgent.__name__ = f"DynamicAgent_{name}"
    DynamicAgent.__qualname__ = f"DynamicAgent_{name}"
    return DynamicAgent
