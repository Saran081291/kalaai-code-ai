"""Google OAuth state/identity hardening, exercised with the real authlib state check."""

from typing import Any

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.auth import google
from app.config import settings

API = "/api/v1"


@pytest.fixture()
def google_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "cid")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "secret")
    monkeypatch.setattr(settings, "FRONTEND_URL", "http://front.test")


def test_callback_without_valid_state_is_rejected(
    client: TestClient, google_configured: None
) -> None:
    """A forged callback (no session state) must never log anyone in."""
    res = client.get(f"{API}/auth/google/callback?code=abc&state=forged", follow_redirects=False)
    assert res.status_code in (302, 307)
    location = res.headers["location"]
    assert location.startswith("http://front.test/login?error=oauth_failed")
    assert "accessToken" not in location


class _Client:
    def __init__(self, userinfo: dict[str, Any]) -> None:
        self.userinfo_data = userinfo

    async def authorize_access_token(self, _request: Request) -> dict[str, Any]:
        return {"access_token": "t"}  # no inline userinfo -> falls back to userinfo()

    async def userinfo(self, token: dict[str, Any]) -> dict[str, Any]:
        return self.userinfo_data


async def _profile(monkeypatch: pytest.MonkeyPatch, info: dict[str, Any]) -> google.GoogleProfile:
    monkeypatch.setattr(google, "get_google_client", lambda: _Client(info))
    return await google.fetch_google_profile(Request({"type": "http", "headers": []}))


@pytest.mark.anyio
@pytest.mark.parametrize("backend", ["asyncio"])
async def test_userinfo_fallback_and_normalisation(
    monkeypatch: pytest.MonkeyPatch, backend: str
) -> None:
    profile = await _profile(
        monkeypatch, {"email": " Me@Example.COM ", "email_verified": True, "name": 5}
    )
    assert profile.email == "me@example.com"
    assert profile.full_name is None


@pytest.mark.anyio
@pytest.mark.parametrize("backend", ["asyncio"])
@pytest.mark.parametrize(
    "info",
    [
        {"email": "a@b.com", "email_verified": False},
        {"email": "", "email_verified": True},
        {"email_verified": True},
    ],
)
async def test_unverified_or_missing_email_rejected(
    monkeypatch: pytest.MonkeyPatch, info: dict[str, Any], backend: str
) -> None:
    with pytest.raises(google.GoogleAuthError):
        await _profile(monkeypatch, info)
