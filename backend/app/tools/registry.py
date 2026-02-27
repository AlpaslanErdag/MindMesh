"""Central Tool Registry with permission enforcement and audit logging."""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Coroutine

import structlog

from app.models.task import AgentActionRecord

logger = structlog.get_logger(__name__)


class ToolPermission(str, Enum):
    read = "read"
    write = "write"
    execute = "execute"
    network = "network"


class ToolDefinition:
    def __init__(
        self,
        name: str,
        description: str,
        permissions: list[ToolPermission],
        handler: Callable[..., Coroutine[Any, Any, Any]],
        requires_hitl: bool = False,
    ):
        self.name = name
        self.description = description
        self.permissions = permissions
        self.handler = handler
        self.requires_hitl = requires_hitl


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ToolDefinition] = {}
        self._audit_log: list[dict[str, Any]] = []

    def register(self, tool: ToolDefinition) -> None:
        self._tools[tool.name] = tool
        logger.info("tool_registered", name=tool.name, permissions=[p.value for p in tool.permissions])

    def get(self, name: str) -> ToolDefinition | None:
        return self._tools.get(name)

    def list_tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": t.name,
                "description": t.description,
                "permissions": [p.value for p in t.permissions],
                "requires_hitl": t.requires_hitl,
            }
            for t in self._tools.values()
        ]

    async def invoke(
        self,
        tool_name: str,
        agent_id: str,
        task_id: str,
        granted_permissions: list[ToolPermission],
        **kwargs: Any,
    ) -> Any:
        tool = self._tools.get(tool_name)
        if tool is None:
            raise ValueError(f"Tool '{tool_name}' not found in registry.")

        missing = [p for p in tool.permissions if p not in granted_permissions]
        if missing:
            raise PermissionError(
                f"Agent '{agent_id}' lacks permissions {missing} to invoke tool '{tool_name}'."
            )

        audit_entry = {
            "id": str(uuid.uuid4()),
            "tool": tool_name,
            "agent_id": agent_id,
            "task_id": task_id,
            "kwargs": kwargs,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "invoked",
        }
        self._audit_log.append(audit_entry)

        logger.info(
            "tool_invoked",
            tool=tool_name,
            agent_id=agent_id,
            task_id=task_id,
        )

        try:
            result = await tool.handler(**kwargs)
            audit_entry["status"] = "success"
            return result
        except Exception as exc:
            audit_entry["status"] = "error"
            audit_entry["error"] = str(exc)
            logger.error("tool_invocation_error", tool=tool_name, error=str(exc))
            raise


registry = ToolRegistry()
