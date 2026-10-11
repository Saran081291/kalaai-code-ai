"""Authentication and role-guard dependencies.

Usage::

    @router.get("/me")
    async def me(user: CurrentUser) -> UserResponse: ...

    @router.post("", dependencies=[Depends(require_role(UserRole.instructor))])
    async def create(...): ...

    async def create(user: User = Depends(require_role(UserRole.instructor))): ...
"""

from collections.abc import Callable
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import decode_access_token
from app.database import get_db
from app.exceptions import ForbiddenError, UnauthorizedError
from app.models import User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def _user_from_credentials(
    credentials: HTTPAuthorizationCredentials | None, db: Session
) -> User | None:
    """Resolve an active user from a Bearer token, or ``None`` if absent/invalid."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        return None
    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        return None
    user = db.scalar(select(User).where(User.id == user_id))
    if user is None or not user.is_active:
        return None
    return user


async def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    """Return the authenticated, active user or raise 401."""
    user = _user_from_credentials(credentials, db)
    if user is None:
        raise UnauthorizedError("Invalid or expired token", code="INVALID_TOKEN")
    return user


async def get_optional_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User | None:
    """Return the authenticated user if a valid token was sent, else ``None``."""
    return _user_from_credentials(credentials, db)


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]


def require_role(*roles: UserRole) -> Callable[..., object]:
    """Build a dependency that allows only users with one of ``roles`` (admins always pass).

    Returns:
        An async dependency returning the current ``User``.
    """

    async def _guard(user: CurrentUser) -> User:
        if user.role != UserRole.admin and user.role not in roles:
            raise ForbiddenError(
                f"This action requires role: {', '.join(r.value for r in roles)}",
                code="ROLE_REQUIRED",
            )
        return user

    return _guard


InstructorUser = Annotated[User, Depends(require_role(UserRole.instructor))]
StudentUser = Annotated[User, Depends(require_role(UserRole.student))]
