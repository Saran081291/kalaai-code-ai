"""FastAPI application entrypoint for Kalaai Code."""

import hashlib
import hmac
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from http import HTTPStatus
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from starlette.concurrency import run_in_threadpool
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.database import SessionLocal
from app.exceptions import AppError
from app.middleware import RequestSizeLimitMiddleware
from app.rate_limit import limiter
from app.routers import api_router
from app.services.pipeline_sweeper import sweep_stuck_submissions

logging.basicConfig(
    level=logging.DEBUG if settings.ENVIRONMENT == "development" else logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


def _ensure_upload_dir() -> Path:
    """Create the upload directory if missing and return its absolute path."""
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir.resolve()


def _sweep_on_startup() -> int:
    """Fail submissions left mid-pipeline by a previous crash/restart (never raises)."""
    try:
        with SessionLocal() as db:
            return sweep_stuck_submissions(db)
    except Exception:
        logger.exception("Startup sweep of stuck submissions failed")
        return 0


def derive_session_secret(secret_key: str) -> str:
    """Derive a separate signing key for the OAuth session cookie from ``SECRET_KEY``."""
    return hmac.new(secret_key.encode("utf-8"), b"session", hashlib.sha256).hexdigest()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Startup/shutdown hook: ensure uploads dir exists and sweep stuck submissions."""
    upload_dir = await run_in_threadpool(_ensure_upload_dir)
    logger.info(
        "Starting %s (%s); uploads at %s",
        settings.APP_NAME,
        settings.ENVIRONMENT,
        upload_dir,
    )
    await run_in_threadpool(_sweep_on_startup)
    yield
    logger.info("Shutting down %s", settings.APP_NAME)


app = FastAPI(title=settings.APP_NAME, version="1.0.0", lifespan=lifespan)

# --- Middleware --------------------------------------------------------------
# Added first = innermost, so CORS headers are still attached to its 413/411 responses.
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Session cookie is only used to hold the OAuth ``state`` during the Google redirect.
app.add_middleware(
    SessionMiddleware,
    secret_key=derive_session_secret(settings.SECRET_KEY),
    session_cookie="kalaai_oauth",
    max_age=600,
    same_site="lax",
    https_only=settings.is_production,
)

# --- Rate limiting -----------------------------------------------------------
app.state.limiter = limiter


def _error_body(detail: str, code: str, **extra: Any) -> dict[str, Any]:
    """Build the standard ``{"detail", "code"}`` error payload."""
    return {"detail": detail, "code": code, **extra}


@app.exception_handler(RateLimitExceeded)
async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Return 429 in the standard error shape (plus Retry-After / X-RateLimit headers)."""
    response = JSONResponse(
        status_code=HTTPStatus.TOO_MANY_REQUESTS,
        content=_error_body(f"Rate limit exceeded: {exc.detail}", "RATE_LIMITED"),
    )
    view_rate_limit = getattr(request.state, "view_rate_limit", None)
    if view_rate_limit is not None:
        response = request.app.state.limiter._inject_headers(response, view_rate_limit)
    return response


# --- Exception handlers ------------------------------------------------------
@app.exception_handler(AppError)
async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    """Render expected application errors as ``{"detail", "code"}``."""
    return JSONResponse(status_code=exc.status_code, content=_error_body(exc.detail, exc.code))


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Render framework HTTP errors (404 route, 405, etc.) in the standard shape."""
    try:
        code = HTTPStatus(exc.status_code).name
    except ValueError:
        code = "HTTP_ERROR"
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(str(exc.detail), code),
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    """Render request validation failures as 422 without echoing submitted input."""
    errors = [
        {"loc": err.get("loc"), "msg": err.get("msg"), "type": err.get("type")}
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
        content=_error_body(
            "Validation error", "VALIDATION_ERROR", errors=jsonable_encoder(errors)
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, _exc: Exception) -> JSONResponse:
    """Log unexpected errors with traceback and return an opaque 500."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
        content=_error_body("Internal server error", "INTERNAL_ERROR"),
    )


# --- Routes ------------------------------------------------------------------
app.include_router(api_router)


def _database_ok() -> bool:
    """Run ``SELECT 1`` against the configured database."""
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        return True
    except Exception:
        logger.exception("Health check database probe failed")
        return False


@app.get("/health", tags=["health"])
async def health() -> JSONResponse:
    """Liveness/readiness probe: 200 when the database answers, 503 otherwise."""
    if await run_in_threadpool(_database_ok):
        return JSONResponse(
            status_code=HTTPStatus.OK, content={"status": "healthy", "database": "ok"}
        )
    return JSONResponse(
        status_code=HTTPStatus.SERVICE_UNAVAILABLE,
        content={"status": "degraded", "database": "error"},
    )
