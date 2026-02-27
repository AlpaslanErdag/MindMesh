import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.memory.relational import get_db
from app.messaging.bus import STREAM_EVENTS, bus
from app.models.task import (
    HITLDecision,
    HITLReviewRecord,
    HITLReviewResponse,
)

router = APIRouter(prefix="/hitl", tags=["HITL"])


def _serialize_review(r: HITLReviewRecord) -> dict[str, Any]:
    return {
        "review_id": str(r.id),
        "task_id": str(r.task_id),
        "agent_id": r.agent_id,
        "action": r.action,
        "payload": r.payload or {},
        "confidence": float(r.confidence or 0),
        "reason": r.reason or "",
        "status": r.status,
        "created_at": r.created_at,
    }


@router.get("/queue", response_model=list[HITLReviewResponse])
async def get_review_queue(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(HITLReviewRecord)
        .where(HITLReviewRecord.status == "pending")
        .order_by(HITLReviewRecord.created_at.asc())
    )
    return [_serialize_review(r) for r in result.scalars().all()]


@router.get("/{review_id}", response_model=HITLReviewResponse)
async def get_review(review_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(HITLReviewRecord).where(HITLReviewRecord.id == review_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Review not found.")
    return _serialize_review(record)


@router.post("/{review_id}/decide", status_code=status.HTTP_200_OK)
async def decide_review(
    review_id: str,
    decision: HITLDecision,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(HITLReviewRecord).where(HITLReviewRecord.id == review_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Review not found.")
    if record.status != "pending":
        raise HTTPException(status_code=400, detail=f"Review already resolved with status '{record.status}'.")

    new_status = "approved" if decision.approved else "rejected"
    await db.execute(
        update(HITLReviewRecord)
        .where(HITLReviewRecord.id == review_id)
        .values(
            status=new_status,
            reviewer_notes=decision.reviewer_notes,
            resolved_at=datetime.utcnow(),
        )
    )
    await db.commit()

    await bus.publish_event(
        {
            "event": "hitl_decision",
            "review_id": review_id,
            "task_id": str(record.task_id),
            "agent_id": record.agent_id,
            "decision": new_status,
            "reviewer_notes": decision.reviewer_notes,
            "timestamp": datetime.utcnow().isoformat(),
        }
    )

    return {"review_id": review_id, "status": new_status}
