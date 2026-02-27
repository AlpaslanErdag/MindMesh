"""Summarizer agent — tüm agent çıktılarını sentezler ve kullanıcıya sunulacak
temiz, yapılandırılmış bir final yanıt üretir.

Neredeyse her iş akışının son adımı olmalıdır (Coder içeren akışlar hariç,
orada Critic son adım olabilir).
"""

from typing import Any

from app.agents.base import BaseAgent
from app.models.task import AgentStatus
from app.tools.registry import ToolPermission

SYSTEM_PROMPT = """You are a Summarizer agent. Your job is to synthesize all prior agent outputs
into a single, clean, well-structured final answer for the user.

Rules:
- Write in clear, professional language.
- Do NOT just repeat raw agent outputs — synthesize and organize them.
- Use markdown formatting (headers, bullet points, bold text) where helpful.
- If research was done, present the key findings clearly.
- If code was produced, include the final code snippet with a brief explanation.
- If a critic reviewed the work, incorporate any important caveats or recommendations.
- Keep it concise but complete.

Respond ONLY with a JSON object:
{
  "title": "Brief descriptive title of the final answer",
  "summary": "One paragraph executive summary",
  "sections": [
    {"heading": "Section Title", "content": "Section content in markdown"}
  ],
  "conclusion": "Final conclusion or recommendation",
  "confidence": 0.0 to 1.0
}
"""


class SummarizerAgent(BaseAgent):
    agent_type = "summarizer"
    granted_permissions = [ToolPermission.read]

    async def run(self, context: dict[str, Any]) -> dict[str, Any]:
        self._set_status(AgentStatus.running)
        objective = context.get("objective", "")
        prior_outputs = context.get("prior_outputs", {})

        prior_text = "\n\n".join(
            f"=== {agent_id} ({_get_type(output)}) ===\n{_format_output(output)}"
            for agent_id, output in prior_outputs.items()
        )

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Original objective: {objective}\n\n"
                    f"Agent outputs to synthesize:\n{prior_text or 'No prior outputs.'}"
                ),
            },
        ]

        raw_response = await self.llm.chat(messages, temperature=0.4)
        confidence = self._estimate_confidence(raw_response)

        import json, re
        result: dict[str, Any] = {}
        try:
            json_match = re.search(r"\{.*\}", raw_response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
        except (json.JSONDecodeError, AttributeError):
            result = {
                "title": f"Summary: {objective[:60]}",
                "summary": raw_response,
                "sections": [],
                "conclusion": "",
                "confidence": confidence,
            }

        self._set_status(AgentStatus.completed)
        return {
            "agent_id": self.agent_id,
            "agent_type": self.agent_type,
            **result,
            "confidence": result.get("confidence", confidence),
        }


def _get_type(output: Any) -> str:
    if isinstance(output, dict):
        return str(output.get("agent_type", "unknown"))
    return "unknown"


def _format_output(output: Any) -> str:
    if not isinstance(output, dict):
        return str(output)[:500]

    parts = []
    for key in ("summary", "plan", "rationale", "code", "explanation",
                "verdict", "strengths", "weaknesses", "recommendations", "key_facts"):
        val = output.get(key)
        if val is None:
            continue
        if isinstance(val, list):
            parts.append(f"{key}: " + "; ".join(str(v) for v in val[:5]))
        elif isinstance(val, str) and val.strip():
            parts.append(f"{key}: {val[:300]}")
        elif isinstance(val, dict):
            parts.append(f"{key}: {str(val)[:200]}")
    return "\n".join(parts) if parts else str(output)[:400]
