#!/bin/sh
# Kalaai Code API container entrypoint.
#   1. wait for PostgreSQL to accept connections
#   2. run Alembic migrations (skip with RUN_MIGRATIONS=false)
#   3. exec the given command, or the production uvicorn server by default
set -e

: "${DB_WAIT_MAX_TRIES:=30}"
: "${DB_WAIT_INTERVAL:=2}"
: "${RUN_MIGRATIONS:=true}"
export DB_WAIT_MAX_TRIES DB_WAIT_INTERVAL

if [ -z "${DATABASE_URL:-}" ]; then
    echo "entrypoint: DATABASE_URL is not set" >&2
    exit 1
fi

python - <<'PY'
import logging
import os
import sys
import time

from sqlalchemy import create_engine, text

logging.basicConfig(level=logging.INFO, format="%(asctime)s entrypoint %(levelname)s %(message)s")
log = logging.getLogger("entrypoint")

max_tries = int(os.environ["DB_WAIT_MAX_TRIES"])
interval = float(os.environ["DB_WAIT_INTERVAL"])
url = os.environ["DATABASE_URL"]
# SQLAlchemy 2.1 defaults postgresql:// to psycopg v3; the image ships psycopg2
# (same normalization as app.database.normalize_database_url).
for prefix in ("postgresql://", "postgres://"):
    if url.startswith(prefix):
        url = "postgresql+psycopg2://" + url[len(prefix):]
        break
engine = create_engine(url, pool_pre_ping=True)

for attempt in range(1, max_tries + 1):
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        log.info("database is ready (attempt %d/%d)", attempt, max_tries)
        engine.dispose()
        sys.exit(0)
    except Exception as exc:  # noqa: BLE001 - any connect error means "not ready yet"
        log.warning("database not ready (attempt %d/%d): %s", attempt, max_tries, type(exc).__name__)
        time.sleep(interval)

log.error("database still unavailable after %d attempts, giving up", max_tries)
sys.exit(1)
PY

if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "entrypoint: running alembic upgrade head"
    alembic upgrade head
fi

if [ "$#" -gt 0 ]; then
    exec "$@"
fi

exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --proxy-headers \
    --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-127.0.0.1}"
