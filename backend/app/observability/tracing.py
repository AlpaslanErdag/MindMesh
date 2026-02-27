import time
import uuid
from contextlib import asynccontextmanager
from typing import Any

import structlog


def configure_logging(log_level: str = "INFO") -> None:
    import logging

    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.ExceptionRenderer(),
    ]

    if log_level == "DEBUG":
        renderer = structlog.dev.ConsoleRenderer()
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=[*shared_processors, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, log_level.upper(), logging.INFO)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


logger = structlog.get_logger(__name__)


class Span:
    def __init__(self, name: str, trace_id: str, parent_id: str | None = None):
        self.span_id = str(uuid.uuid4())[:8]
        self.trace_id = trace_id
        self.parent_id = parent_id
        self.name = name
        self.start_time = time.monotonic()
        self.attributes: dict[str, Any] = {}
        self.events: list[dict] = []

    def set_attribute(self, key: str, value: Any) -> None:
        self.attributes[key] = value

    def add_event(self, name: str, attributes: dict | None = None) -> None:
        self.events.append({
            "name": name,
            "attributes": attributes or {},
            "time": time.monotonic(),
        })

    def end(self) -> float:
        duration = (time.monotonic() - self.start_time) * 1000
        logger.info(
            "span_ended",
            trace_id=self.trace_id,
            span_id=self.span_id,
            name=self.name,
            duration_ms=round(duration, 2),
            attributes=self.attributes,
        )
        return duration


class Tracer:
    def __init__(self, service_name: str):
        self.service_name = service_name

    @asynccontextmanager
    async def start_span(
        self,
        name: str,
        trace_id: str | None = None,
        parent_id: str | None = None,
    ):
        trace_id = trace_id or str(uuid.uuid4())
        span = Span(name=name, trace_id=trace_id, parent_id=parent_id)
        logger.info("span_started", trace_id=trace_id, span_id=span.span_id, name=name)
        try:
            yield span
        except Exception as exc:
            span.set_attribute("error", str(exc))
            span.set_attribute("error_type", type(exc).__name__)
            raise
        finally:
            span.end()


tracer = Tracer(service_name="multi-agent-platform")
