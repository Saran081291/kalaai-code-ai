# syntax=docker/dockerfile:1
# Kalaai Code API - multi-stage image (FastAPI + Alembic on Python 3.11)

# ---------------------------------------------------------------------------
# Stage 1: builder - resolve and install dependencies into an isolated venv
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    VIRTUAL_ENV=/opt/venv

# Build tools only live in this stage (fallback for packages without wheels).
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv "$VIRTUAL_ENV"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

COPY requirements.txt /tmp/requirements.txt
RUN pip install --upgrade pip wheel \
    && pip install -r /tmp/requirements.txt

# ---------------------------------------------------------------------------
# Stage 2: runtime - slim image, non-root user, no compilers
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    UPLOAD_DIR=/app/uploads

RUN groupadd --system app \
    && useradd --system --gid app --home-dir /app --shell /usr/sbin/nologin app

WORKDIR /app

COPY --from=builder /opt/venv /opt/venv

COPY --chown=app:app alembic.ini ./alembic.ini
COPY --chown=app:app alembic ./alembic
COPY --chown=app:app app ./app
# Entrypoint lives outside /app so a dev bind-mount of ./backend cannot shadow it.
COPY --chmod=0755 scripts/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN mkdir -p /app/uploads && chown -R app:app /app/uploads

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
# Empty CMD -> entrypoint starts the production uvicorn server.
# Any CMD/command override (e.g. uvicorn --reload in dev) runs after migrations.
CMD []
