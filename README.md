# Kalaai Code 🌶️

[![CI](https://github.com/Saran081291/kalaai-code-ai/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Saran081291/kalaai-code-ai/actions/workflows/ci.yml)

**AI code review for student assignments.** A student submits code and gets a serious,
rubric-based review first. Then comes the fun part: a roast of the *code* in Madurai
Tanglish slang, at a spice level the student picks.

> *"Roast code-ku mattum dhaan, person-ku illa."*

---

## What it does

1. An **instructor** creates a course, shares its join code, and builds an assignment with a
   rubric (criteria whose points add up to the max score).
2. A **student** joins the course and submits a **public GitHub repo** or **uploaded files /
   a zip**, then picks a spice level: `mild`, `medium` or `mass`.
3. An AI **reviews the code against the rubric**: a score per criterion, strengths, and
   issues pinned to `file:line`, with suggestions.
4. A second AI call writes the **Madurai Tanglish roast**, which is checked by guardrails
   before the student sees it.
5. Students can share roasts to the course **Roast Wall** (reactions, public share card), and
   a per-course **Leaderboard** ranks best scores. Instructors can override scores and hide roasts.

Roles: `student`, `instructor`, `admin`.

## Tech stack

| Layer | Choice |
|-------|--------|
| Backend | FastAPI, Python 3.11+, SQLAlchemy 2.0, Alembic |
| Database | PostgreSQL 16 |
| Frontend | React, TypeScript, Vite, Chakra UI, Framer Motion, TanStack Query |
| Auth | JWT (access + refresh), email/password, Google OAuth |
| AI | Anthropic Claude **or** OpenAI (switchable, see [AI provider](#ai-provider)) |
| Tooling | Docker Compose, GitHub Actions, ruff, mypy, pytest, Vitest |

---

## Quick start (Docker)

You need Docker and **one** AI key (Anthropic or OpenAI).

```bash
# 1. Create your local env file (git-ignored, never commit it)
cp .env.example .env

# 2. Edit .env and set at least:
#    SECRET_KEY         python -c "import secrets; print(secrets.token_urlsafe(48))"
#    POSTGRES_PASSWORD  a URL-safe value (letters, digits, - _)
#    an AI key          ANTHROPIC_API_KEY=...   or   AI_PROVIDER=openai + OPENAI_API_KEY=...

# 3. Build and start
docker compose up -d --build        # or: make up
```

| What | Where |
|------|-------|
| App (UI) | http://localhost:3000 |
| API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Health check | http://localhost:8000/health → `{"status":"healthy","database":"ok"}` |

The first build takes a minute or two; later builds reuse Docker's cache. Migrations run
automatically when the API container starts. Stop with `docker compose down` (data is kept),
or `make clean` to also delete the database volume.

### Try it end to end

1. Register an **instructor**, create a course (note its join code), add an assignment with
   a rubric, and **publish** it.
2. Register a **student**, join with the code, open the assignment, and submit a GitHub URL
   or some files.
3. Watch the progress steps (fetching → AI review → Madurai roast), then read the review and
   the roast, and share it to the Roast Wall.

---

## Configuration

Everything is set through environment variables. `.env.example` documents every one;
`backend/.env.example` is the same for running the backend outside Docker.

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | **Required.** JWT signing key. Production refuses to start with the default. |
| `POSTGRES_PASSWORD` | **Required.** Database password (compose builds `DATABASE_URL` from `POSTGRES_*`). |
| `AI_PROVIDER` | `anthropic` (default) or `openai` |
| `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` | Used when `AI_PROVIDER=anthropic` (default model `claude-opus-5-5`) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Used when `AI_PROVIDER=openai` (default model `gpt-5.5`) |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `GOOGLE_REDIRECT_URI` | Optional Google sign-in |
| `GITHUB_TOKEN` | Optional. Raises the GitHub API rate limit when fetching repos |
| `MAX_UPLOAD_MB`, `MAX_UPLOAD_FILES` | Upload limits (default 5 MB, 50 files) |
| `VITE_API_URL` | API URL as seen by the browser. **Baked into the frontend at build time**; rebuild `web` after changing it |

### AI provider

All model calls go through one wrapper, `backend/app/services/ai_client.py`, so switching
provider is a configuration change and needs no code change.

- **Anthropic (default):** set `ANTHROPIC_API_KEY`.
- **OpenAI:** set `AI_PROVIDER=openai` and `OPENAI_API_KEY`.
- On a sample review + roast comparison, `gpt-5.5` gave the most accurate issue line numbers and
  the most coherent Tanglish. `gpt-4o-mini` was the weakest. A larger model costs more and
  is slower (about 20 s for a review plus a roast).
- Student code is treated as **untrusted data**: it is delimited in the prompt, the model is
  told to ignore instructions inside it, scores are clamped and recomputed server-side, and
  student code is **never executed**.

### Google sign-in (optional)

Create an OAuth client (type **Web application**) in the Google Cloud Console. Add
`http://localhost:8000/api/v1/auth/google/callback` as an authorized redirect URI and
`http://localhost:3000` as an authorized JavaScript origin. Put the client ID and secret in
`.env`, then restart the API. While the consent screen is in *Testing* mode, add your
account as a test user.

---

## Roast guardrails

The roast targets the **code, never the person**. Every roast is checked before it is stored:

- Tanglish only (Tamil words in English letters). Tamil script is rejected.
- No profanity at any spice level.
- No remarks on intelligence, looks, family, caste, religion, gender, region or background.
- Must reference a real finding from the review and end on an encouraging line.
- Punchline ≤ 140 characters. A roast that fails the checks is regenerated, then falls back to a
  safe canned roast.

The guard lives in `backend/app/services/roast_guard.py` and is covered by tests, including
prompt-injection and personal-attack cases.

---

## Development

```bash
make install     # backend venv + pip deps, frontend npm deps
make dev         # hot-reload stack in Docker (api :8000, vite :5173)
make up          # production-like stack (web :3000, api :8000)
make logs        # follow the production-like stack's logs
make test        # backend (80% coverage gate) + frontend
make lint        # ruff, ruff format, mypy, eslint, tsc
make help        # every target
```

`make` needs GNU make; on Windows use Git Bash or WSL, or run the commands in the `Makefile`
by hand. Without `make`:

```bash
# Backend
cd backend
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload
pytest --cov=app --cov-fail-under=80
ruff check . && ruff format --check . && mypy app

# Frontend
cd frontend
npm install
npm run dev
npm test
npm run lint && npm run type-check
```

Backend tests mock the AI client, so they never call a real model or need an API key.

### CI

GitHub Actions (`.github/workflows/ci.yml`) runs on pushes and PRs to `main`, on `ubuntu-24.04`:

| Job | Steps |
|-----|-------|
| Backend | ruff, ruff format check, mypy, Alembic migrations on Postgres, pytest with an 80% coverage gate |
| Frontend | eslint, type-check, Vitest, production build |
| Docker | validates both compose files and builds the images |

---

## Project layout

```
.
├── backend/
│   ├── app/
│   │   ├── routers/      auth, courses, assignments, submissions, reviews, roasts, wall, dashboard, public
│   │   ├── services/     ai_client, review_service, roast_service, roast_guard, code_fetcher, pipeline, ...
│   │   ├── models/       SQLAlchemy models
│   │   ├── schemas/      Pydantic request/response models
│   │   ├── prompts/      review_system.md, roast_system.md
│   │   └── auth/         JWT, Google OAuth, role dependencies
│   ├── alembic/          migrations
│   └── tests/
├── frontend/src/         pages, components, hooks, services, types, theme
├── docker-compose.yml        production-like stack
├── docker-compose.dev.yml    hot-reload dev stack
├── Makefile
└── .github/workflows/ci.yml
```

All API endpoints live under `/api/v1/`.

## How this repo was built

Kalaai Code was generated from a Claude Code project template using the PRP workflow. The
files that drove it are kept in the repo:

| Path | Purpose |
|------|---------|
| `INITIAL.md` | The product definition |
| `PRPs/kalaai-code-prp.md` | The generated implementation plan |
| `PRPs/phase2-contracts.md` | API contracts shared between the backend and frontend work |
| `CLAUDE.md` | Project rules for Claude Code (stack, forbidden patterns, module rules) |
| `agents/`, `skills/`, `.claude/commands/` | Agent definitions, code-pattern guides, custom commands |

---

## Notes

- Student uploads are limited to 5 MB and 50 files, and zips are checked for path traversal.
- Submissions run as background tasks, and each status change is saved; a failed run stores
  its error and can be retried. A failure while *fetching* code does not use up an attempt.

## License

[MIT](LICENSE) © 2026 Saran081291
