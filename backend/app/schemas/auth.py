"""Request/response schemas for the authentication endpoints (camelCase JSON)."""

from typing import Literal

from pydantic import EmailStr, Field, field_validator

from app.auth.security import BCRYPT_MAX_BYTES
from app.schemas.base import CamelModel

# Roles a user may self-assign at registration; ``admin`` is rejected with 422.
RegisterableRole = Literal["student", "instructor"]

PASSWORD_MIN_LENGTH = 8


def _normalize_email(value: object) -> object:
    """Strip whitespace and lowercase an email before ``EmailStr`` validation."""
    if isinstance(value, str):
        return value.strip().lower()
    return value


class RegisterRequest(CamelModel):
    """Body of ``POST /auth/register``."""

    email: EmailStr
    password: str = Field(min_length=PASSWORD_MIN_LENGTH, max_length=BCRYPT_MAX_BYTES)
    full_name: str = Field(min_length=1, max_length=100)
    role: RegisterableRole = "student"

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, value: object) -> object:
        """Lowercase and strip the email before validation."""
        return _normalize_email(value)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        """Reject passwords whose UTF-8 encoding exceeds bcrypt's 72-byte limit."""
        if len(value.encode("utf-8")) > BCRYPT_MAX_BYTES:
            raise ValueError(
                f"Password must be at most {BCRYPT_MAX_BYTES} bytes when UTF-8 encoded"
            )
        return value

    @field_validator("full_name")
    @classmethod
    def strip_full_name(cls, value: str) -> str:
        """Trim the display name and refuse whitespace-only names."""
        stripped = value.strip()
        if not stripped:
            raise ValueError("Full name must not be blank")
        return stripped


class LoginRequest(CamelModel):
    """Body of ``POST /auth/login``."""

    email: EmailStr
    # No bcrypt limit here: over-long passwords simply fail verification (no hint given).
    password: str = Field(min_length=1, max_length=1024)

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, value: object) -> object:
        """Lowercase and strip the email before validation."""
        return _normalize_email(value)


class RefreshTokenRequest(CamelModel):
    """Body of ``POST /auth/refresh`` and ``POST /auth/logout``."""

    refresh_token: str = Field(min_length=1, max_length=512)


class TokenPair(CamelModel):
    """Response of register / login / refresh: ``{accessToken, refreshToken, tokenType}``."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105 - OAuth token type, not a secret


__all__ = [
    "LoginRequest",
    "RefreshTokenRequest",
    "RegisterRequest",
    "RegisterableRole",
    "TokenPair",
]
