.PHONY: help up down logs build dev-backend dev-frontend

help:
	@echo "Multi-Agent Platform"
	@echo "-------------------"
	@echo "make up            - Start all services (Docker)"
	@echo "make up-local-llm  - Start with Ollama profile"
	@echo "make down          - Stop all services"
	@echo "make build         - Rebuild all Docker images"
	@echo "make logs          - Tail all logs"
	@echo "make dev-backend   - Run backend locally (requires .env)"
	@echo "make dev-frontend  - Run frontend locally"
	@echo "make pull-model    - Pull default Mistral model into Ollama"

up:
	docker compose up -d

up-local-llm:
	docker compose --profile local-llm up -d

down:
	docker compose down

build:
	docker compose build --no-cache

logs:
	docker compose logs -f

dev-backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8065

dev-frontend:
	cd frontend && npm run dev

pull-model:
	docker compose exec ollama ollama pull mistral
