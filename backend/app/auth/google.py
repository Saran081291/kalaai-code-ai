"""Google OAuth (OpenID Connect) client built on authlib's Starlette integration.

authlib stores and verifies the OAuth ``state`` (and OIDC ``nonce``) in the session
cookie provided by ``SessionMiddleware`` (installed in ``app.main``).
"""

import logging
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

from authlib.integrations.starlette_client import OAuth, StarletteOAuth2App
from starlette.requests import Request

from app.config import settings
from app.exceptions import BadRequestError

logger = logging.getLogger(__name__)

GOOGLE_CLIENT_NAME = "google"
GOOGLE_METADATA_URL = "https://accounts.google.com/.well-known/openid-configuration"
GOOGLE_SCOPE = "openid email profile"

_oauth: OAuth | None = None


class GoogleAuthError(Exception):
    """The Google callback could not be turned into a verified identity."""


@dataclass(frozen=True)
class GoogleProfile:
    """Verified identity returned by Google."""

    email: str
    full_name: str | None
    avatar_url: str | None


def is_google_configured() -> bool:
    """Return True when Google OAuth credentials are present in settings."""
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def get_google_client() -> StarletteOAuth2App:
    """Return the (lazily registered) authlib Google client.

    Raises:
        BadRequestError: ``OAUTH_NOT_CONFIGURED`` when credentials are missing.
    """
    global _oauth
    if not is_google_configured():
        raise BadRequestError("Google login is not configured", code="OAUTH_NOT_CONFIGURED")
    if _oauth is None:
        oauth = OAuth()
        oauth.register(
            name=GOOGLE_CLIENT_NAME,
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            server_metadata_url=GOOGLE_METADATA_URL,
            client_kwargs={"scope": GOOGLE_SCOPE},
        )
        _oauth = oauth
    client: StarletteOAuth2App = _oauth.create_client(GOOGLE_CLIENT_NAME)
    return client


async def fetch_google_profile(request: Request) -> GoogleProfile:
    """Complete the authorization-code exchange and return the verified Google identity.

    ``authorize_access_token`` verifies the ``state`` stored in the session and validates
    the ID token.

    Raises:
        GoogleAuthError: on any OAuth failure, missing email or unverified email.
    """
    client = get_google_client()
    try:
        token: dict[str, Any] = await client.authorize_access_token(request)
        userinfo: dict[str, Any] | None = token.get("userinfo")
        if not userinfo:
            userinfo = dict(await client.userinfo(token=token))
    except BadRequestError:
        raise
    except Exception as exc:
        logger.warning("Google OAuth token exchange failed: %s", type(exc).__name__)
        raise GoogleAuthError("Google token exchange failed") from exc

    email = userinfo.get("email")
    if not isinstance(email, str) or not email:
        raise GoogleAuthError("Google account has no email")
    if userinfo.get("email_verified") not in (True, "true"):
        raise GoogleAuthError("Google email is not verified")

    name = userinfo.get("name")
    picture = userinfo.get("picture")
    return GoogleProfile(
        email=email.strip().lower(),
        full_name=name if isinstance(name, str) else None,
        avatar_url=picture if isinstance(picture, str) else None,
    )


def _frontend_base() -> str:
    """Frontend origin without a trailing slash."""
    return settings.FRONTEND_URL.rstrip("/")


def frontend_success_url(access_token: str, refresh_token: str) -> str:
    """Frontend callback URL carrying tokens in the fragment (never sent to servers)."""
    fragment = urlencode({"accessToken": access_token, "refreshToken": refresh_token})
    return f"{_frontend_base()}/auth/google/callback#{fragment}"


def frontend_error_url(error: str) -> str:
    """Frontend login URL with an ``error`` query parameter (e.g. ``oauth_failed``)."""
    return f"{_frontend_base()}/login?{urlencode({'error': error})}"


__all__ = [
    "GoogleAuthError",
    "GoogleProfile",
    "fetch_google_profile",
    "frontend_error_url",
    "frontend_success_url",
    "get_google_client",
    "is_google_configured",
]
