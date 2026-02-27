"""Redis Streams-based publish/subscribe message bus.

All inter-agent communication flows through this module.
No direct agent-to-agent synchronous calls are allowed.
"""

import json
from typing import Any, AsyncGenerator

import redis.asyncio as aioredis
import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)

STREAM_TASKS = "stream:tasks"
STREAM_AGENTS = "stream:agents"
STREAM_HITL = "stream:hitl"
STREAM_EVENTS = "stream:events"

GROUP_ORCHESTRATOR = "group:orchestrator"
GROUP_PLANNER = "group:planner"
GROUP_RESEARCHER = "group:researcher"
GROUP_CODER = "group:coder"
GROUP_CRITIC = "group:critic"


class MessageBus:
    def __init__(self) -> None:
        self._client: aioredis.Redis | None = None

    async def connect(self) -> None:
        settings = get_settings()
        self._client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        await self._ensure_groups()
        logger.info("message_bus_connected", url=settings.redis_url)

    async def disconnect(self) -> None:
        if self._client:
            await self._client.aclose()

    @property
    def client(self) -> aioredis.Redis:
        if not self._client:
            raise RuntimeError("MessageBus not connected. Call connect() first.")
        return self._client

    async def _ensure_groups(self) -> None:
        streams_groups = [
            (STREAM_TASKS, GROUP_ORCHESTRATOR),
            (STREAM_AGENTS, GROUP_PLANNER),
            (STREAM_AGENTS, GROUP_RESEARCHER),
            (STREAM_AGENTS, GROUP_CODER),
            (STREAM_AGENTS, GROUP_CRITIC),
            (STREAM_HITL, GROUP_ORCHESTRATOR),
        ]
        for stream, group in streams_groups:
            try:
                await self.client.xgroup_create(stream, group, id="0", mkstream=True)
            except aioredis.ResponseError as exc:
                if "BUSYGROUP" not in str(exc):
                    raise

    async def publish(self, stream: str, payload: dict[str, Any]) -> str:
        message_id = await self.client.xadd(stream, {"data": json.dumps(payload)})
        logger.debug("message_published", stream=stream, message_id=message_id)
        return message_id

    async def consume(
        self,
        stream: str,
        group: str,
        consumer: str,
        count: int = 10,
        block_ms: int = 2000,
    ) -> list[dict[str, Any]]:
        messages = await self.client.xreadgroup(
            groupname=group,
            consumername=consumer,
            streams={stream: ">"},
            count=count,
            block=block_ms,
        )
        if not messages:
            return []
        results = []
        for _, entries in messages:
            for msg_id, data in entries:
                payload = json.loads(data["data"])
                payload["_msg_id"] = msg_id
                results.append(payload)
        return results

    async def ack(self, stream: str, group: str, message_id: str) -> None:
        await self.client.xack(stream, group, message_id)

    async def publish_event(self, event: dict[str, Any]) -> None:
        await self.publish(STREAM_EVENTS, event)

    async def iter_events(self, last_id: str = "$") -> AsyncGenerator[dict[str, Any], None]:
        """Read new events from the events stream (for WebSocket broadcasting)."""
        while True:
            messages = await self.client.xread(streams={STREAM_EVENTS: last_id}, block=1000, count=50)
            for _, entries in (messages or []):
                for msg_id, data in entries:
                    last_id = msg_id
                    yield json.loads(data["data"])


bus = MessageBus()
