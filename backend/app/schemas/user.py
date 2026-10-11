"""User response and profile-update schemas (mirror ``frontend/src/types/user.ts``)."""

from datetime import datetime
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, field_validator

from app.models.enums import SpiceLevel, UserRole
from app.schemas.base import CamelModel

AVATAR_URL_MAX_LENGTH = 500

OAuthProvider = Literal["google"]


class UserResponse(CamelModel):
    """Public representation of a user account (``User`` in the frontend)."""

    id: int
    email: str
    full_name: str | None
    avatar_url: str | None
    role: UserRole
    default_spice_level: SpiceLevel
    is_active: bool
    is_verified: bool
    oauth_provider: OAuthProvider | None
    created_at: datetime
    updated_at: datetime


class UpdateProfileRequest(CamelModel):
    """Body of ``PUT /auth/me``. Omitted fields are left unchanged.

    ``fullName: null`` is treated as "no change" (the name is required);
    ``avatarUrl: null`` (or an empty string) clears the avatar.
    """

    full_name: str | None = Field(default=None, max_length=100)
    avatar_url: str | None = Field(default=None, max_length=AVATAR_URL_MAX_LENGTH)
    default_spice_level: SpiceLevel | None = None

    @field_validator("full_name")
    @classmethod
    def strip_full_name(cls, value: str | None) -> str | None:
        """Trim the display name and refuse whitespace-only names."""
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Full name must not be blank")
        return stripped

    @field_validator("avatar_url")
    @classmethod
    def validate_avatar_url(cls, value: str | None) -> str | None:
        """Accept only absolute http(s) URLs; an empty string means "clear"."""
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            return None
        parsed = urlparse(stripped)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Avatar URL must be an absolute http(s) URL")
        return stripped


__all__ = ["OAuthProvider", "UpdateProfileRequest", "UserResponse"]
