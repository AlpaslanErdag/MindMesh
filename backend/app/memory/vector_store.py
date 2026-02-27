"""Qdrant vector store adapter for semantic memory retrieval."""

import uuid
from typing import Any

import structlog
from qdrant_client import AsyncQdrantClient
from qdrant_client.http.models import (
    Distance,
    PointStruct,
    VectorParams,
)

from app.config import get_settings

logger = structlog.get_logger(__name__)

_client: AsyncQdrantClient | None = None


async def get_vector_client() -> AsyncQdrantClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = AsyncQdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
        await _ensure_collection(_client)
    return _client


async def _ensure_collection(client: AsyncQdrantClient) -> None:
    settings = get_settings()
    collections = await client.get_collections()
    names = [c.name for c in collections.collections]
    if settings.qdrant_collection not in names:
        await client.create_collection(
            collection_name=settings.qdrant_collection,
            vectors_config=VectorParams(
                size=settings.embedding_dimension,
                distance=Distance.COSINE,
            ),
        )
        logger.info("qdrant_collection_created", name=settings.qdrant_collection)


async def upsert_memory(
    content: str,
    embedding: list[float],
    metadata: dict[str, Any],
) -> str:
    client = await get_vector_client()
    settings = get_settings()
    point_id = str(uuid.uuid4())
    await client.upsert(
        collection_name=settings.qdrant_collection,
        points=[
            PointStruct(
                id=point_id,
                vector=embedding,
                payload={"content": content, **metadata},
            )
        ],
    )
    logger.debug("memory_upserted", point_id=point_id)
    return point_id


async def search_memory(
    query_embedding: list[float],
    top_k: int = 5,
    filter_metadata: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    client = await get_vector_client()
    settings = get_settings()
    results = await client.search(
        collection_name=settings.qdrant_collection,
        query_vector=query_embedding,
        limit=top_k,
    )
    return [
        {"id": str(r.id), "score": r.score, "payload": r.payload}
        for r in results
    ]
