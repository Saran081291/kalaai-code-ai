"""Authentication endpoints: register, login, refresh, logout, profile, Google OAuth."""

import logging
from http import HTTPStatus

from fastapi import APIRouter, Request, Response
from fastapi.responses import RedirectResponse
from starlette.concurrency import run_in_threadpool

from app.auth import google
from app.auth.dependencies import CurrentUser, DbSession
from app.config import settings
from app.models import UserRole
from app.rate_limit import limiter
from app.schemas.auth import LoginRequest, RefreshTokenRequest, RegisterRequest, TokenPair
from app.schemas.user import UpdateProfileRequest, UserResponse
from app.services import auth_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])


def _redirect(url: str) -> RedirectResponse:
    """Plain 302 redirect (browser navigation during the OAuth flow)."""
    return RedirectResponse(url, status_code=HTTPStatus.FOUND)


@router.post("/auth/register", response_model=TokenPair, status_code=HTTPStatus.CREATED)
@limiter.limit("5/minute")
async def register(request: Request, payload: RegisterRequest, db: DbSession) -> TokenPair:
    """Create a student or instructor account and return a token pair (409 if email taken)."""

    def _register() -> TokenPair:
        user = auth_service.register_user(
            db,
            email=payload.email,
            password=payload.password,
            full_name=payload.full_name,
            role=UserRole(payload.role),
        )
        return auth_service.issue_token_pair(db, user)

    return await run_in_threadpool(_register)


@router.post("/auth/login", response_model=TokenPair)
@limiter.limit("5/minute")
async def login(request: Request, payload: LoginRequest, db: DbSession) -> TokenPair:
    """Exchange email/password for a token pair (401 ``INVALID_CREDENTIALS`` on any failure)."""

    def _login() -> TokenPair:
        user = auth_service.authenticate(db, email=payload.email, password=payload.password)
        return auth_service.issue_token_pair(db, user)

    return await run_in_threadpool(_login)


@router.post("/auth/refresh", response_model=TokenPair)
@limiter.limit("10/minute")
async def refresh(request: Request, payload: RefreshTokenRequest, db: DbSession) -> TokenPair:
    """Rotate a refresh token: revoke the presented one and issue a new pair."""
    return await run_in_threadpool(auth_service.rotate_refresh_token, db, payload.refresh_token)


@router.post("/auth/logout", status_code=HTTPStatus.NO_CONTENT, response_class=Response)
async def logout(payload: RefreshTokenRequest, db: DbSession) -> Response:
    """Revoke the given refresh token (idempotent: unknown tokens are ignored)."""
    await run_in_threadpool(auth_service.revoke_refresh_token, db, payload.refresh_token)
    return Response(status_code=HTTPStatus.NO_CONTENT)


@router.get("/auth/me", response_model=UserResponse)
async def get_me(user: CurrentUser) -> UserResponse:
    """Return the authenticated user's profile."""
    return UserResponse.model_validate(user)


@router.put("/auth/me", response_model=UserResponse)
async def update_me(
    payload: UpdateProfileRequest, user: CurrentUser, db: DbSession
) -> UserResponse:
    """Update full name, avatar URL and/or default spice level of the current user."""
    updated = await run_in_threadpool(auth_service.update_profile, db, user, payload)
    return UserResponse.model_validate(updated)


@router.get("/auth/google/login", response_class=RedirectResponse)
async def google_login(request: Request) -> Response:
    """Redirect the browser to Google's consent screen (400 ``OAUTH_NOT_CONFIGURED``)."""
    client = google.get_google_client()
    response: Response = await client.authorize_redirect(request, settings.GOOGLE_REDIRECT_URI)
    return response


@router.get("/auth/google/callback", response_class=RedirectResponse)
async def google_callback(request: Request, db: DbSession) -> RedirectResponse:
    """Finish Google login and redirect to the frontend with tokens in the URL fragment."""
    if not google.is_google_configured():
        return _redirect(google.frontend_error_url("oauth_failed"))
    try:
        profile = await google.fetch_google_profile(request)
    except google.GoogleAuthError as exc:
        logger.warning("Google callback rejected: %s", exc)
        return _redirect(google.frontend_error_url("oauth_failed"))

    user = await run_in_threadpool(
        lambda: auth_service.upsert_google_user(
            db,
            email=profile.email,
            full_name=profile.full_name,
            avatar_url=profile.avatar_url,
        )
    )
    if not user.is_active:
        logger.info("Google login refused for inactive user id=%s", user.id)
        return _redirect(google.frontend_error_url("account_disabled"))

    tokens = await run_in_threadpool(auth_service.issue_token_pair, db, user)
    return _redirect(google.frontend_success_url(tokens.access_token, tokens.refresh_token))
