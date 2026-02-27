# Roadmap — Multi-Agent Platform

> Status legend: ✅ Done · 🚧 In Progress · 📋 Planned · 💡 Idea

---

## v1.0 — Core Platform ✅ (Current)

### Architecture
- [x] Central Orchestrator with DAG-based task routing
- [x] 5 Built-in agents: Planner, Researcher, Coder, Critic, Summarizer
- [x] Hybrid memory: PostgreSQL (state/audit) + Qdrant (vector search)
- [x] Tool Registry with permission enforcement and audit log
- [x] Docker sandboxed code execution (`--network=none`, `--read-only`)
- [x] Redis Streams async message bus (no direct agent-to-agent calls)
- [x] HITL gate: low-confidence actions pause for human approval
- [x] Structured logging with `structlog` + span-based tracing

### Frontend
- [x] Real-time DAG visualization (React Flow) via WebSocket
- [x] Live event feed with timestamps
- [x] Task submission form (objective, priority, tags)
- [x] Task list with status indicators and cancellation
- [x] Task detail page: DAG + per-agent outputs (plan, summary, code, review)
- [x] HITL Console: payload inspection, approve / reject with reviewer notes
- [x] Agent Management: built-in catalogue + custom agent creation
- [x] Custom agent prompt templates (Translator, Data Analyst, SEO Expert)
- [x] Provider-agnostic LLM wrapper (Ollama `/v1`, OpenAI, vLLM)

---

## v1.1 — Quality & UX 📋

### Backend
- [ ] **Task filtering & search** — filter by status, priority, tags, date range
- [ ] **Retry logic** — failed agents auto-retry with exponential backoff (via `tenacity`)
- [ ] **Agent timeout** — per-agent configurable timeout; orphaned agents killed cleanly
- [ ] **HITL audit log API** — endpoint returning full decision history with reviewer notes
- [ ] **Webhook notifications** — POST to user-defined URL on task complete / HITL triggered
- [ ] **Streaming LLM responses** — stream token-by-token to frontend via WebSocket
- [ ] **Memory retrieval** — agents query Qdrant for context from past tasks

### Frontend
- [ ] **Task filters & sort** — filter by status/priority, sort by date/duration
- [ ] **Bulk HITL actions** — approve / reject all pending reviews at once
- [ ] **HITL audit history** — scrollable log of past decisions on the HITL page
- [ ] **Task search** — full-text search over objectives
- [ ] **Dashboard stats bar** — total tasks, running count, avg. completion time
- [ ] **Keyboard shortcuts** — `N` new task, `R` refresh, `A/R` approve/reject in HITL

---

## v2.0 — Advanced Orchestration 📋

### Multi-Agent Improvements
- [ ] **Agent chaining strategies** — parallel, sequential, fan-out/fan-in patterns
- [ ] **Dynamic replanning** — Orchestrator can re-plan mid-execution if an agent fails
- [ ] **Agent versioning** — save/restore custom agent prompt versions
- [ ] **Agent performance metrics** — success rate, avg. confidence, avg. runtime per agent
- [ ] **Conditional DAG edges** — edges with conditions (e.g. "only if critic score ≥ 7")
- [ ] **Sub-task spawning** — agents can spawn child tasks

### Memory & Knowledge
- [ ] **Long-term memory** — agents automatically store findings in Qdrant for future tasks
- [ ] **Knowledge base import** — upload PDFs/documents as searchable context
- [ ] **Session context** — pass prior task results as context to new tasks

### Tools
- [ ] **File I/O tool** — read/write files in sandboxed temp directories
- [ ] **Browser automation** — Playwright-based web scraping tool
- [ ] **Database query tool** — read-only SQL queries against user-defined connections
- [ ] **Image analysis** — vision-capable LLM tool for image understanding tasks

---

## v2.1 — Integrations 💡

- [ ] **Slack notifications** — send task completion / HITL alerts to Slack channels
- [ ] **GitHub integration** — trigger tasks from PR/issue events; commit code output
- [ ] **REST API webhooks** — subscribe to platform events via webhook registration
- [ ] **Zapier / n8n connector** — expose platform as automation workflow node
- [ ] **OpenTelemetry export** — send traces to Jaeger, Tempo or Datadog

---

## v3.0 — Production Hardening 💡

### Security
- [ ] **Authentication** — JWT-based auth with user accounts and API keys
- [ ] **Role-based access control** — admin, operator, viewer roles
- [ ] **Rate limiting** — per-user task submission throttle
- [ ] **Secret management** — integration with HashiCorp Vault or AWS Secrets Manager

### Scalability
- [ ] **Agent worker pool** — run agents in separate containers/processes (Celery or arq)
- [ ] **Horizontal scaling** — multiple backend instances with shared Redis state
- [ ] **Task queue prioritization** — critical tasks jump the queue
- [ ] **Result caching** — cache identical sub-tasks across different parent tasks

### Observability
- [ ] **Metrics dashboard** — Prometheus + Grafana integration
- [ ] **Distributed tracing UI** — Jaeger or Tempo for full trace visualization
- [ ] **Alerting** — alert on high HITL queue depth, agent failure rate, LLM latency

---

## How to Contribute / Request Features

1. Open an issue describing the feature and its use case
2. Label it with the appropriate milestone (`v1.1`, `v2.0`, etc.)
3. Implement following the existing patterns — `BaseAgent` for agents, `ToolDefinition` for tools
