import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import AGENT_REGISTRY
from app.memory.relational import get_db
from app.models.task import CustomAgentCreate, CustomAgentRecord, CustomAgentResponse
from app.tools.registry import registry

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.get("/types")
async def list_agent_types(db: AsyncSession = Depends(get_db)):
    built_in = [
        {"id": k, "name": k, "description": "", "is_custom": False}
        for k in AGENT_REGISTRY
    ]
    result = await db.execute(select(CustomAgentRecord).order_by(CustomAgentRecord.created_at))
    customs = [
        {"id": str(r.id), "name": r.name, "description": r.description,
         "color": r.color, "is_custom": True, "created_at": r.created_at.isoformat()}
        for r in result.scalars().all()
    ]
    return {"built_in": built_in, "custom": customs}


@router.get("/tools")
async def list_tools():
    return {"tools": registry.list_tools()}


# ── Custom Agent CRUD ──────────────────────────────────────────────────────────

@router.get("/custom", response_model=list[CustomAgentResponse])
async def list_custom_agents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CustomAgentRecord).order_by(CustomAgentRecord.created_at.desc())
    )
    records = result.scalars().all()
    return [
        CustomAgentResponse(
            id=str(r.id),
            name=r.name,
            description=r.description,
            system_prompt=r.system_prompt,
            color=r.color,
            created_at=r.created_at,
        )
        for r in records
    ]


@router.post("/custom", response_model=CustomAgentResponse, status_code=status.HTTP_201_CREATED)
async def create_custom_agent(
    payload: CustomAgentCreate,
    db: AsyncSession = Depends(get_db),
):
    # built-in isimlerle çakışma kontrolü
    if payload.name in AGENT_REGISTRY:
        raise HTTPException(
            status_code=400,
            detail=f"'{payload.name}' built-in agent adıyla çakışıyor.",
        )

    existing = await db.execute(
        select(CustomAgentRecord).where(CustomAgentRecord.name == payload.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"'{payload.name}' adında agent zaten mevcut.")

    record = CustomAgentRecord(
        id=str(uuid.uuid4()),
        name=payload.name,
        description=payload.description,
        system_prompt=payload.system_prompt,
        color=payload.color,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return CustomAgentResponse(
        id=str(record.id),
        name=record.name,
        description=record.description,
        system_prompt=record.system_prompt,
        color=record.color,
        created_at=record.created_at,
    )


@router.get("/custom/{agent_id}", response_model=CustomAgentResponse)
async def get_custom_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CustomAgentRecord).where(CustomAgentRecord.id == agent_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Agent bulunamadı.")
    return CustomAgentResponse(
        id=str(record.id),
        name=record.name,
        description=record.description,
        system_prompt=record.system_prompt,
        color=record.color,
        created_at=record.created_at,
    )


@router.delete("/custom/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_custom_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CustomAgentRecord).where(CustomAgentRecord.id == agent_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Agent bulunamadı.")
    await db.execute(delete(CustomAgentRecord).where(CustomAgentRecord.id == agent_id))
    await db.commit()
