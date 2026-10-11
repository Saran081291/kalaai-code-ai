"""Pure-ASGI request-size guard (audit H1).

Rejects oversized bodies *before* Starlette parses (and spools) them:

- ``POST /api/v1/assignments/{id}/submissions`` (multipart upload) may carry up to
  ``MAX_UPLOAD_MB * 1.5 MiB`` plus a small slack for multipart framing,
- every other endpoint is capped at 1 MiB (JSON APIs).

A multipart upload without ``Content-Length`` (chunked transfer) is refused with 411 because
its size cannot be checked up front. Bodies that lie about / omit their length are also
counted while streaming and cut off with 413 once over the cap.
"""

import json
import re

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import settings

MiB = 1024 * 1024
DEFAULT_BODY_LIMIT = 1 * MiB
UPLOAD_SLACK = 64 * 1024
_UPLOAD_PATH = re.compile(r"^/api/v1/assignments/[^/]+/submissions/?$")
_BODY_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


class _BodyTooLargeError(Exception):
    """Raised from the wrapped ``receive`` when a streamed body exceeds the cap."""


def _upload_limit_bytes() -> int:
    return int(settings.MAX_UPLOAD_MB * 1.5 * MiB) + UPLOAD_SLACK


def body_limit_for(method: str, path: str) -> tuple[int, bool]:
    """Return ``(max_bytes, is_upload)`` for a request."""
    if method == "POST" and _UPLOAD_PATH.match(path):
        return _upload_limit_bytes(), True
    return DEFAULT_BODY_LIMIT, False


async def _send_error(send: Send, status: int, detail: str, code: str) -> None:
    body = json.dumps({"detail": detail, "code": code}).encode("utf-8")
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode("ascii")),
                (b"connection", b"close"),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})


class RequestSizeLimitMiddleware:
    """Reject over-large request bodies with 413 ``UPLOAD_TOO_LARGE`` (411 for chunked uploads)."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] not in _BODY_METHODS:
            await self.app(scope, receive, send)
            return

        limit, is_upload = body_limit_for(scope["method"], scope["path"])
        headers: dict[bytes, bytes] = dict(scope.get("headers", []))
        raw_length = headers.get(b"content-length")
        too_large = f"Request body too large (max {limit // 1024} KiB for this endpoint)"

        if raw_length is not None:
            try:
                declared = int(raw_length)
            except ValueError:
                await _send_error(send, 400, "Invalid Content-Length header", "BAD_REQUEST")
                return
            if declared > limit:
                await _send_error(send, 413, too_large, "UPLOAD_TOO_LARGE")
                return
        elif is_upload and headers.get(b"content-type", b"").lower().startswith(
            b"multipart/form-data"
        ):
            await _send_error(
                send, 411, "Content-Length header is required for uploads", "LENGTH_REQUIRED"
            )
            return

        received = 0
        started = False

        async def counting_receive() -> Message:
            nonlocal received
            message: Message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise _BodyTooLargeError
            return message

        async def tracking_send(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, counting_receive, tracking_send)
        except _BodyTooLargeError:
            if not started:
                await _send_error(send, 413, too_large, "UPLOAD_TOO_LARGE")


__all__ = ["RequestSizeLimitMiddleware", "body_limit_for"]
