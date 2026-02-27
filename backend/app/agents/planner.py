"""Planner agent — görevi analiz eder ve yalnızca gerekli agent'lardan
oluşan bir yürütme planı üretir.

KURAL: Hiçbir agent varsayılan olarak plana dahil edilmez.
Her agent yalnızca gerçekten gerektiğinde seçilir.
"""

import json
import re
from typing import Any

from app.agents.base import BaseAgent
from app.models.task import AgentStatus
from app.tools.registry import ToolPermission

SYSTEM_PROMPT = """You are a Planner agent. Analyze the objective and create a minimal,
efficient execution plan using ONLY the agents that are genuinely needed.

## Available Agents

| Agent       | Use when...                                                         | Skip when...                          |
|-------------|---------------------------------------------------------------------|---------------------------------------|
| researcher  | Task needs factual information, research, web data, comparisons     | Task is purely about coding or math   |
| coder       | Task EXPLICITLY asks to write, generate, or run code/scripts        | No code is needed at all              |
| critic      | Output quality must be reviewed before delivery (high-stakes tasks) | Simple, low-risk tasks                |
| summarizer  | Multiple agents produced output that must be synthesized for user   | Only one agent was used               |

## Decision Rules

1. Research-only task (e.g. "explain X", "compare Y vs Z", "what is W"):
   → researcher → summarizer

2. Research + summary task:
   → researcher → summarizer

3. Coding-only task (e.g. "write a function that...", "implement X"):
   → coder → critic

4. Research + coding task (e.g. "research X then build Y"):
   → researcher → coder → critic → summarizer

5. Analysis or review task:
   → researcher → critic → summarizer

6. Simple single-question task:
   → researcher → summarizer

CRITICAL RULES:
- NEVER include `coder` unless the objective explicitly mentions writing code,
  implementing something, building a program, or running a script.
- ALWAYS include `summarizer` when 2+ agents produce output.
- NEVER add steps "just in case" — minimal is better.
- `depends_on` must list the step numbers that must complete before this step starts.

## Output Format

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "plan": [
    {"step": 1, "agent_type": "researcher", "task": "Specific task description", "depends_on": []},
    {"step": 2, "agent_type": "summarizer", "task": "Synthesize findings into final answer", "depends_on": [1]}
  ],
  "rationale": "One sentence explaining why these specific agents were chosen"
}
"""


async def _custom_agents_section() -> str:
    """DB'deki custom agent'ları çekip Planner prompt'una ek tablo olarak ekler."""
    try:
        from sqlalchemy import select
        from app.models.task import CustomAgentRecord
        from app.memory.relational import get_session_factory

        factory = get_session_factory()
        async with factory() as db:
            result = await db.execute(select(CustomAgentRecord))
            agents = result.scalars().all()

        if not agents:
            return ""

        rows = "\n".join(
            f"| {a.name} | {a.description[:80]} | Only when task explicitly needs {a.name} |"
            for a in agents
        )
        return f"\n\n## Custom Agents (User-Defined)\n\n| Agent | Purpose | Use when |\n|-------|---------|----------|\n{rows}\n"
    except Exception:
        return ""


class PlannerAgent(BaseAgent):
    agent_type = "planner"
    granted_permissions = [ToolPermission.read]

    async def run(self, context: dict[str, Any]) -> dict[str, Any]:
        self._set_status(AgentStatus.running)
        objective = context.get("objective", "")

        system_prompt = SYSTEM_PROMPT + await _custom_agents_section()

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Objective: {objective}"},
        ]

        raw_response = await self.llm.chat(messages, temperature=0.2)
        confidence = self._estimate_confidence(raw_response)

        plan: list[dict[str, Any]] = []
        rationale = ""

        try:
            json_match = re.search(r"\{.*\}", raw_response, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group())
                plan = parsed.get("plan", [])
                rationale = parsed.get("rationale", "")
        except (json.JSONDecodeError, AttributeError):
            self._log.warning("planner_parse_error", raw=raw_response[:300])

        # Fallback: sade araştırma + özetleme planı
        if not plan:
            plan = [
                {"step": 1, "agent_type": "researcher", "task": objective, "depends_on": []},
                {"step": 2, "agent_type": "summarizer", "task": f"Summarize findings about: {objective}", "depends_on": [1]},
            ]
            rationale = "Fallback plan: research and summarize."

        self._set_status(AgentStatus.completed)
        self._log.info("plan_created", steps=len(plan), agents=[s["agent_type"] for s in plan])

        return {
            "agent_id": self.agent_id,
            "agent_type": self.agent_type,
            "plan": plan,
            "rationale": rationale,
            "confidence": confidence,
        }
