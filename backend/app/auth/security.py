"""Password hashing (bcrypt) and token helpers (JWT access, opaque refresh)."""

import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.config import settings
from app.models.enums import UserRole

logger = logging.getLogger(__name__)

# bcrypt only uses the first 72 bytes of a password; schemas cap length accordingly.
BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    """Hash a plain-text password with bcrypt.

    Args:
        password: Plain-text password (at most 72 bytes when UTF-8 encoded).

    Returns:
        The bcrypt hash as a string.
    """
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str | None) -> bool:
    """Check a plain-text password against a bcrypt hash.

    Returns ``False`` for OAuth-only accounts (no hash) or malformed input.
    """
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int, role: UserRole) -> str:
    """Create a signed JWT access token carrying the user id (``sub``) and role."""
    expire = datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role.value,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decode and validate a JWT access token.

    Returns:
        The token payload, or ``None`` if it is invalid, expired, or not an access token.
    """
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError:
        return None
    if payload.get("type") != "access" or "sub" not in payload:
        return None
    return payload


def hash_token(raw_token: str) -> str:
    """Return the SHA-256 hex digest used to store refresh tokens."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def generate_refresh_token() -> tuple[str, str, datetime]:
    """Generate an opaque refresh token.

    Returns:
        ``(raw_token, token_hash, expires_at)`` - only the hash is persisted.
    """
    raw_token = secrets.token_urlsafe(48)
    expires_at = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return raw_token, hash_token(raw_token), expires_at
