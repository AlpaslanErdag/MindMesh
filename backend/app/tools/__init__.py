"""Tool registry bootstrapper — registers all built-in tools on import."""

from app.tools.code_runner import run_code_in_sandbox
from app.tools.registry import ToolDefinition, ToolPermission, registry
from app.tools.web_search import web_search


def bootstrap_tools() -> None:
    registry.register(
        ToolDefinition(
            name="web_search",
            description="Search the web and return relevant snippets.",
            permissions=[ToolPermission.network],
            handler=web_search,
        )
    )
    registry.register(
        ToolDefinition(
            name="run_code",
            description="Execute Python code inside an isolated Docker container.",
            permissions=[ToolPermission.execute],
            handler=run_code_in_sandbox,
            requires_hitl=True,
        )
    )
