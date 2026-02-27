"""Researcher agent — gathers information from the web and memory."""

from typing import Any

import structlog

from app.agents.base import BaseAgent
from app.models.task import AgentStatus
from app.tools.registry import ToolPermission

logger = structlog.get_logger(__name__)

SYSTEM_PROMPT = """You are a Researcher agent. Your job is to gather accurate, relevant information
to answer the given research task. You have access to web search results.

Synthesize the search results into a clear, concise summary. Include key facts and sources.
Respond with a JSON object:
{
  "summary": "Comprehensive answer to the research task",
  "sources": ["url1", "url2"],
  "key_facts": ["fact1", "fact2"],
  "confidence": 0.0 to 1.0
}
"""


class ResearcherAgent(BaseAgent):
    agent_type = "researcher"
    granted_permissions = [ToolPermission.read, ToolPermission.network]

    async def run(self, context: dict[str, Any]) -> dict[str, Any]:
        self._set_status(AgentStatus.running)
        task = context.get("task", context.get("objective", ""))

        search_results = []
        try:
            search_results = await self.use_tool("web_search", query=task, max_results=5)
        except Exception as exc:
            self._log.warning("web_search_failed", error=str(exc))

        search_context = "\n".join(
            f"[{i+1}] {r.get('title', '')} — {r.get('snippet', '')} ({r.get('url', '')})"
            for i, r in enumerate(search_results)
        )

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Research task: {task}\n\nSearch results:\n{search_context or 'No results available.'}",
            },
        ]

        raw_response = await self.llm.chat(messages, temperature=0.4)
        confidence = self._estimate_confidence(raw_response)

        import json, re
        result = {}
        try:
            json_match = re.search(r"\{.*\}", raw_response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
        except (json.JSONDecodeError, AttributeError):
            result = {
                "summary": raw_response,
                "sources": [r.get("url", "") for r in search_results],
                "key_facts": [],
                "confidence": confidence,
            }

        self._set_status(AgentStatus.completed)
        return {
            "agent_id": self.agent_id,
            "agent_type": self.agent_type,
            **result,
            "confidence": result.get("confidence", confidence),
        }
