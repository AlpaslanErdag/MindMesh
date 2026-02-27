"""Web search tool using DuckDuckGo (no API key) or Serper API."""

from typing import Any

import httpx
import structlog

from app.config import get_settings

logger = structlog.get_logger(__name__)


async def web_search(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    settings = get_settings()
    if settings.search_engine == "serper" and settings.serper_api_key:
        return await _serper_search(query, max_results, settings.serper_api_key)
    return await _duckduckgo_search(query, max_results)


async def _duckduckgo_search(query: str, max_results: int) -> list[dict[str, Any]]:
    url = "https://api.duckduckgo.com/"
    params = {"q": query, "format": "json", "no_html": "1", "skip_disambig": "1"}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    results = []
    for topic in data.get("RelatedTopics", [])[:max_results]:
        if isinstance(topic, dict) and "Text" in topic:
            results.append({"title": topic.get("Text", ""), "url": topic.get("FirstURL", ""), "snippet": topic.get("Text", "")})
    return results


async def _serper_search(query: str, max_results: int, api_key: str) -> list[dict[str, Any]]:
    url = "https://google.serper.dev/search"
    headers = {"X-API-KEY": api_key, "Content-Type": "application/json"}
    payload = {"q": query, "num": max_results}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    return [
        {"title": r.get("title", ""), "url": r.get("link", ""), "snippet": r.get("snippet", "")}
        for r in data.get("organic", [])[:max_results]
    ]
