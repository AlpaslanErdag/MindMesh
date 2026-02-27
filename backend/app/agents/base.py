"""Base agent class. All specialized agents inherit from this."""

import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

import httpx
import structlog

from app.config import get_settings
from app.models.task import AgentStatus
from app.tools.registry import ToolPermission, registry

logger = structlog.get_logger(__name__)


class LLMClient:
    """Agnostic LLM wrapper — works with OpenAI API, Ollama, and any compatible endpoint."""

    def __init__(self) -> None:
        settings = get_settings()
        self._base_url = settings.llm_base_url
        self._model = settings.llm_model
        self._api_key = settings.llm_api_key
        self._provider = settings.llm_provider

    async def chat(self, messages: list[dict[str, str]], temperature: float = 0.7) -> str:
        settings = get_settings()

        if self._provider == "ollama":
            url = f"{self._base_url}/api/chat"
            payload = {
                "model": self._model,
                "messages": messages,
                "stream": False,
                "options": {"temperature": temperature},
            }
            async with httpx.AsyncClient(timeout=120) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data["message"]["content"]

        # OpenAI-compatible (openai, ollama /v1, vllm, litellm, etc.)
        url = f"{self._base_url}/chat/completions"
        api_key = self._api_key or "ollama"
        headers = {"Authorization": f"Bearer {api_key}"}
        payload = {
            "model": self._model,
            "messages": messages,
            "temperature": temperature,
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=180) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]


class BaseAgent(ABC):
    agent_type: str = "base"
    granted_permissions: list[ToolPermission] = []

    def __init__(self, task_id: str, node_id: str | None = None):
        self.agent_id = node_id or f"{self.agent_type}-{str(uuid.uuid4())[:8]}"
        self.task_id = task_id
        self.status: AgentStatus = AgentStatus.pending
        self.llm = LLMClient()
        self._log = logger.bind(agent_id=self.agent_id, task_id=task_id, agent_type=self.agent_type)

    @abstractmethod
    async def run(self, context: dict[str, Any]) -> dict[str, Any]:
        """Execute the agent's main logic. Returns a result dict."""
        ...

    async def use_tool(self, tool_name: str, **kwargs: Any) -> Any:
        return await registry.invoke(
            tool_name=tool_name,
            agent_id=self.agent_id,
            task_id=self.task_id,
            granted_permissions=self.granted_permissions,
            **kwargs,
        )

    def _set_status(self, status: AgentStatus) -> None:
        self.status = status
        self._log.info("agent_status_change", new_status=status)

    def _estimate_confidence(self, response: str) -> float:
        """Heuristic confidence based on response length and specificity."""
        if not response or len(response) < 50:
            return 0.4
        if any(phrase in response.lower() for phrase in ["i don't know", "i cannot", "uncertain", "unsure"]):
            return 0.45
        return min(0.95, 0.6 + len(response) / 5000)
