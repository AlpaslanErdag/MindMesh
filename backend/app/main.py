import asyncio
import uuid
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import agents, hitl, tasks
from app.api.websocket import stream_events_to_clients, websocket_endpoint
from app.config import get_settings
from app.memory.relational import init_db
from app.messaging.bus import bus
from app.observability.tracing import configure_logging
from app.tools import bootstrap_tools

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    logger.info("startup", env=settings.app_env)

    await init_db()
    await bus.connect()
    bootstrap_tools()

    event_task = asyncio.create_task(stream_events_to_clients())

    yield

    event_task.cancel()
    await bus.disconnect()
    logger.info("shutdown")


settings = get_settings()

app = FastAPI(
    title="Multi-Agent Platform",
    description="Scalable, full-stack Multi-Agent AI Platform with real-time DAG execution.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks.router, prefix="/api/v1")
app.include_router(hitl.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")


@app.websocket("/ws/{client_id}")
async def ws_endpoint(websocket: WebSocket, client_id: str):
    await websocket_endpoint(websocket, client_id)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "multi-agent-platform"}
