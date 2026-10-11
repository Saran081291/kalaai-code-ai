# Kalaai Code - developer shortcuts
#
# Requires GNU make. On Windows run from Git Bash or WSL (or just run the
# commands shown under each target manually in PowerShell).
#
#   make install   # backend venv + pip deps, frontend npm deps
#   make dev       # full hot-reload stack in Docker (docker-compose.dev.yml)
#   make up        # production-like stack (docker-compose.yml) on :3000 / :8000

.DEFAULT_GOAL := help
.PHONY: help env install dev up down logs migrate test test-backend test-frontend \
        lint lint-backend lint-frontend format build config clean

COMPOSE     ?= docker compose
COMPOSE_DEV ?= docker compose -f docker-compose.dev.yml

ifeq ($(OS),Windows_NT)
VENV_BIN := .venv/Scripts
else
VENV_BIN := .venv/bin
endif
PY := $(VENV_BIN)/python

help: ## List available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

env: ## Create .env files from the examples (does not overwrite)
	@test -f .env || cp .env.example .env
	@test -f backend/.env || cp backend/.env.example backend/.env

install: ## Install backend (venv) and frontend dependencies
	cd backend && python -m venv .venv && $(PY) -m pip install --upgrade pip && $(PY) -m pip install -r requirements-dev.txt
	cd frontend && npm install

dev: env ## Run the hot-reload dev stack (db + api :8000 + vite :5173)
	$(COMPOSE_DEV) up --build

up: env ## Start the production-like stack in the background (web :3000, api :8000)
	$(COMPOSE) up -d --build

down: ## Stop both stacks
	$(COMPOSE) down
	$(COMPOSE_DEV) down

logs: ## Follow logs of the production-like stack
	$(COMPOSE) logs -f

migrate: ## Run alembic migrations inside the running api container
	$(COMPOSE) exec api alembic upgrade head

test: test-backend test-frontend ## Run all tests

test-backend: ## Backend tests with coverage gate (local venv, needs Postgres)
	cd backend && $(VENV_BIN)/pytest --cov=app --cov-fail-under=80

test-frontend: ## Frontend unit tests (vitest)
	cd frontend && npm test

lint: lint-backend lint-frontend ## Lint + type-check everything

lint-backend:
	cd backend && $(VENV_BIN)/ruff check . && $(VENV_BIN)/ruff format --check . && $(VENV_BIN)/mypy app

lint-frontend:
	cd frontend && npm run lint && npm run type-check

format: ## Auto-format / auto-fix backend code
	cd backend && $(VENV_BIN)/ruff format . && $(VENV_BIN)/ruff check --fix .

build: env ## Build Docker images
	$(COMPOSE) build

config: env ## Validate both compose files
	$(COMPOSE) config --quiet
	$(COMPOSE_DEV) config --quiet

clean: ## Stop stacks and delete their volumes (DESTROYS local DB data)
	$(COMPOSE) down -v
	$(COMPOSE_DEV) down -v
