"""WebSocket manager — broadcasts real-time agent events to all connected clients."""

import asyncio
import json
from typing import Any

import structlog
from fastapi import WebSocket, WebSocketDisconnect

from app.messaging.bus import STREAM_EVENTS, bus

logger = structlog.get_logger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, WebSocket] = {}

    async def connect(self, client_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[client_id] = websocket
        logger.info("ws_client_connected", client_id=client_id, total=len(self._connections))

    def disconnect(self, client_id: str) -> None:
        self._connections.pop(client_id, None)
        logger.info("ws_client_disconnected", client_id=client_id, total=len(self._connections))

    async def broadcast(self, message: dict[str, Any]) -> None:
        dead = []
        for client_id, ws in self._connections.items():
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(client_id)
        for cid in dead:
            self.disconnect(cid)

    async def send_to(self, client_id: str, message: dict[str, Any]) -> None:
        ws = self._connections.get(client_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(client_id)

    @property
    def active_connections(self) -> int:
        return len(self._connections)


manager = ConnectionManager()


async def stream_events_to_clients() -> None:
    """Background task that reads Redis event stream and broadcasts to WS clients."""
    async for event in bus.iter_events():
        if manager.active_connections > 0:
            await manager.broadcast(event)


async def websocket_endpoint(websocket: WebSocket, client_id: str) -> None:
    await manager.connect(client_id, websocket)
    try:
        await websocket.send_json({"event": "connected", "client_id": client_id, "message": "Welcome to MAP WebSocket."})
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("ping"):
                    await websocket.send_json({"pong": True})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(client_id)
