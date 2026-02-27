import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import JSON, Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class TaskStatus(str, Enum):
    pending = "pending"
    planning = "planning"
    running = "running"
    waiting_hitl = "waiting_hitl"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class AgentStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    waiting_hitl = "waiting_hitl"


class TaskPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


# ─── SQLAlchemy ORM Models ─────────────────────────────────────────────────────

class TaskRecord(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    objective = Column(Text, nullable=False)
    priority = Column(String(20), default=TaskPriority.medium)
    status = Column(String(30), default=TaskStatus.pending)
    tags = Column(JSON, default=list)
    context = Column(JSON, default=dict)
    dag_snapshot = Column(JSON, default=dict)
    result = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AgentActionRecord(Base):
    __tablename__ = "agent_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), nullable=False)
    agent_id = Column(String(100), nullable=False)
    agent_type = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False)
    input_data = Column(JSON, default=dict)
    output_data = Column(JSON, nullable=True)
    status = Column(String(30), default="pending")
    confidence = Column(String(10), nullable=True)
    duration_ms = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class CustomAgentRecord(Base):
    __tablename__ = "custom_agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(60), nullable=False, unique=True)
    description = Column(Text, nullable=False)
    system_prompt = Column(Text, nullable=False)
    permissions = Column(JSON, default=list)
    color = Column(String(20), default="slate")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HITLReviewRecord(Base):
    __tablename__ = "hitl_reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), nullable=False)
    agent_id = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)
    payload = Column(JSON, default=dict)
    confidence = Column(String(10), nullable=True)
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="pending")
    reviewer_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)


# ─── Pydantic Schemas ──────────────────────────────────────────────────────────

class TaskCreate(BaseModel):
    objective: str = Field(..., min_length=10, max_length=2000)
    priority: TaskPriority = TaskPriority.medium
    tags: list[str] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)


class DAGNode(BaseModel):
    id: str
    type: str
    label: str
    status: AgentStatus = AgentStatus.pending
    message: str = ""
    confidence: float | None = None


class DAGEdge(BaseModel):
    source: str
    target: str


class TaskResponse(BaseModel):
    task_id: str
    objective: str
    priority: TaskPriority
    status: TaskStatus
    tags: list[str]
    dag_nodes: list[DAGNode] = []
    dag_edges: list[DAGEdge] = []
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HITLReviewCreate(BaseModel):
    task_id: str
    agent_id: str
    action: str
    payload: dict[str, Any]
    confidence: float
    reason: str


class HITLReviewResponse(BaseModel):
    review_id: str
    task_id: str
    agent_id: str
    action: str
    payload: dict[str, Any]
    confidence: float
    reason: str
    status: str
    created_at: datetime


class HITLDecision(BaseModel):
    approved: bool
    reviewer_notes: str = ""
    modified_payload: dict[str, Any] | None = None


class CustomAgentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=60, pattern=r"^[a-z0-9_]+$")
    description: str = Field(..., min_length=10, max_length=500)
    system_prompt: str = Field(..., min_length=20)
    color: str = "slate"


class CustomAgentResponse(BaseModel):
    id: str
    name: str
    description: str
    system_prompt: str
    color: str
    created_at: datetime

    model_config = {"from_attributes": True}


class WebSocketEvent(BaseModel):
    event: str
    task_id: str | None = None
    agent_id: str | None = None
    agent_type: str | None = None
    status: str | None = None
    message: str = ""
    confidence: float | None = None
    data: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
