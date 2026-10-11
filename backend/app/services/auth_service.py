"""Authentication business logic: accounts, credentials, refresh-token rotation, OAuth upsert."""

import logging
from datetime import UTC, datetime
from functools import lru_cache

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.exceptions import ConflictError, UnauthorizedError
from app.models import RefreshToken, User, UserRole
from app.schemas.auth import TokenPair
from app.schemas.user import AVATAR_URL_MAX_LENGTH, UpdateProfileRequest

logger = logging.getLogger(__name__)

GOOGLE_PROVIDER = "google"
FULL_NAME_MAX_LENGTH = 100

INVALID_CREDENTIALS_MESSAGE = "Invalid email or password"
INVALID_REFRESH_MESSAGE = "Invalid or expired refresh token"


def _invalid_credentials() -> UnauthorizedError:
    """Build the single, non-enumerating login failure error."""
    return UnauthorizedError(INVALID_CREDENTIALS_MESSAGE, code="INVALID_CREDENTIALS")


def _invalid_refresh() -> UnauthorizedError:
    """Build the refresh-token failure error."""
    return UnauthorizedError(INVALID_REFRESH_MESSAGE, code="INVALID_REFRESH_TOKEN")


@lru_cache(maxsize=1)
def _dummy_password_hash() -> str:
    """Return a throwaway bcrypt hash used to equalise timing for unknown emails."""
    return hash_password("timing-equaliser-not-a-real-password")


def _as_utc(value: datetime) -> datetime:
    """Treat naive datetimes (e.g. from SQLite) as UTC."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def get_user_by_email(db: Session, email: str) -> User | None:
    """Return the user with ``email`` (case-insensitive input, stored lowercase) or ``None``."""
    return db.scalar(select(User).where(User.email == email.strip().lower()))


def register_user(
    db: Session, *, email: str, password: str, full_name: str, role: UserRole
) -> User:
    """Create a password-based account.

    Args:
        db: Database session.
        email: Email address (normalised to lowercase).
        password: Plain-text password (validated to fit bcrypt's 72-byte limit).
        full_name: Display name.
        role: ``student`` or ``instructor`` (``admin`` is rejected at the schema layer).

    Returns:
        The persisted user.

    Raises:
        ConflictError: ``EMAIL_TAKEN`` if the email is already registered.
    """
    normalized_email = email.strip().lower()
    if get_user_by_email(db, normalized_email) is not None:
        raise ConflictError("An account with this email already exists", code="EMAIL_TAKEN")

    user = User(
        email=normalized_email,
        hashed_password=hash_password(password),
        full_name=full_name,
        role=role,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            "An account with this email already exists", code="EMAIL_TAKEN"
        ) from exc
    db.refresh(user)
    logger.info("Registered user id=%s role=%s", user.id, user.role.value)
    return user


def authenticate(db: Session, *, email: str, password: str) -> User:
    """Verify email/password credentials.

    Unknown email, wrong password, OAuth-only account and inactive account all raise the
    same error so the endpoint cannot be used to enumerate accounts.

    Raises:
        UnauthorizedError: ``INVALID_CREDENTIALS``.
    """
    user = get_user_by_email(db, email)
    if user is None:
        verify_password(password, _dummy_password_hash())
        raise _invalid_credentials()
    if not verify_password(password, user.hashed_password) or not user.is_active:
        raise _invalid_credentials()
    return user


def issue_token_pair(db: Session, user: User) -> TokenPair:
    """Create an access token and a persisted (hashed) refresh token for ``user``.

    Commits the session.
    """
    raw_token, token_hash, expires_at = generate_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at))
    db.commit()
    return TokenPair(
        access_token=create_access_token(user.id, user.role),
        refresh_token=raw_token,
    )


def _revoke_all_user_tokens(db: Session, user_id: int) -> None:
    """Revoke every refresh token of ``user_id`` (does not commit)."""
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
        .values(revoked=True)
    )


def rotate_refresh_token(db: Session, raw_token: str) -> TokenPair:
    """Exchange a valid refresh token for a new pair, revoking the old one.

    Reuse detection: presenting an already-revoked token revokes *all* of the user's
    refresh tokens, forcing every session of that user to log in again.

    Raises:
        UnauthorizedError: ``INVALID_REFRESH_TOKEN`` for unknown, revoked or expired tokens
            or when the owning user is inactive.
    """
    stored = db.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == hash_token(raw_token))
        .with_for_update()
    )
    if stored is None:
        raise _invalid_refresh()

    if stored.revoked:
        logger.warning(
            "Refresh token reuse detected for user id=%s; revoking all sessions", stored.user_id
        )
        _revoke_all_user_tokens(db, stored.user_id)
        db.commit()
        raise _invalid_refresh()

    if _as_utc(stored.expires_at) <= datetime.now(UTC):
        stored.revoked = True
        db.commit()
        raise _invalid_refresh()

    user = db.get(User, stored.user_id)
    if user is None or not user.is_active:
        _revoke_all_user_tokens(db, stored.user_id)
        db.commit()
        raise _invalid_refresh()

    stored.revoked = True
    return issue_token_pair(db, user)


def revoke_refresh_token(db: Session, raw_token: str) -> None:
    """Revoke a refresh token if it exists (idempotent; unknown tokens are ignored)."""
    result = db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == hash_token(raw_token), RefreshToken.revoked.is_(False))
        .values(revoked=True)
    )
    db.commit()
    if getattr(result, "rowcount", 0):
        logger.info("Refresh token revoked on logout")


def update_profile(db: Session, user: User, data: UpdateProfileRequest) -> User:
    """Apply a partial profile update to ``user``.

    Only fields present in the request body are considered; ``fullName: null`` is ignored
    (the name is required) while ``avatarUrl: null`` clears the avatar.
    """
    fields = data.model_fields_set
    if "full_name" in fields and data.full_name is not None:
        user.full_name = data.full_name
    if "avatar_url" in fields:
        user.avatar_url = data.avatar_url
    if "default_spice_level" in fields and data.default_spice_level is not None:
        user.default_spice_level = data.default_spice_level
    db.commit()
    db.refresh(user)
    return user


def upsert_google_user(
    db: Session, *, email: str, full_name: str | None, avatar_url: str | None
) -> User:
    """Find or create the account for a verified Google identity.

    Existing account (matched by email): link ``oauth_provider="google"`` if unset, fill a
    missing avatar and mark the email verified. New account: ``student`` role, no password.

    Returns:
        The user (callers must still check ``is_active``).
    """
    normalized_email = email.strip().lower()
    safe_avatar = avatar_url if avatar_url and len(avatar_url) <= AVATAR_URL_MAX_LENGTH else None
    name = (full_name or "").strip() or normalized_email.split("@", 1)[0]
    name = name[:FULL_NAME_MAX_LENGTH]

    user = get_user_by_email(db, normalized_email)
    if user is not None:
        if user.oauth_provider is None:
            user.oauth_provider = GOOGLE_PROVIDER
        if not user.avatar_url and safe_avatar:
            user.avatar_url = safe_avatar
        user.is_verified = True
        db.commit()
        db.refresh(user)
        logger.info("Google login linked to existing user id=%s", user.id)
        return user

    user = User(
        email=normalized_email,
        hashed_password=None,
        full_name=name,
        avatar_url=safe_avatar,
        role=UserRole.student,
        oauth_provider=GOOGLE_PROVIDER,
        is_verified=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Concurrent first login for the same email: fall back to the row that won.
        db.rollback()
        existing = get_user_by_email(db, normalized_email)
        if existing is None:
            raise
        return existing
    db.refresh(user)
    logger.info("Created user id=%s via Google OAuth", user.id)
    return user


__all__ = [
    "authenticate",
    "get_user_by_email",
    "issue_token_pair",
    "register_user",
    "revoke_refresh_token",
    "rotate_refresh_token",
    "update_profile",
    "upsert_google_user",
]
