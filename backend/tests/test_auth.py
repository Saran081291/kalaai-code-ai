"""Tests for the ``/api/v1/auth/*`` endpoints (self-contained fixtures)."""

from collections.abc import Iterator
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
from authlib.integrations.starlette_client import OAuthError
from fastapi import APIRouter
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.auth import google
from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models import RefreshToken, User, UserRole
from app.rate_limit import limiter
from app.routers import auth as auth_router

API = "/api/v1"
PASSWORD = "supersecret1"

if not any(getattr(route, "path", None) == f"{API}/auth/me" for route in app.routes):
    _api = APIRouter(prefix=API)
    _api.include_router(auth_router.router)
    app.include_router(_api)


@pytest.fixture()
def db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Session]:
    monkeypatch.setattr(limiter, "enabled", False)
    engine = create_engine(
        f"sqlite:///{tmp_path / 'auth.db'}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def _override_get_db() -> Iterator[Session]:
        session = factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = _override_get_db
    session = factory()
    try:
        yield session
    finally:
        session.close()
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


@pytest.fixture()
def client(db: Session) -> TestClient:
    return TestClient(app)


def register(
    client: TestClient,
    email: str = "Kumar@Example.com ",
    password: str = PASSWORD,
    role: str = "student",
) -> Any:
    return client.post(
        f"{API}/auth/register",
        json={"email": email, "password": password, "fullName": "Kumar", "role": role},
    )


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


# --------------------------------------------------------------------------- #
# Register / me
# --------------------------------------------------------------------------- #


def test_register_then_me(client: TestClient) -> None:
    res = register(client, role="instructor")
    assert res.status_code == 201
    tokens = res.json()
    assert set(tokens) == {"accessToken", "refreshToken", "tokenType"}
    assert tokens["tokenType"] == "bearer"

    me = client.get(f"{API}/auth/me", headers=bearer(tokens["accessToken"]))
    assert me.status_code == 200
    body = me.json()
    assert set(body) == {
        "id",
        "email",
        "fullName",
        "avatarUrl",
        "role",
        "defaultSpiceLevel",
        "isActive",
        "isVerified",
        "oauthProvider",
        "createdAt",
        "updatedAt",
    }
    assert body["email"] == "kumar@example.com"
    assert body["role"] == "instructor"
    assert body["defaultSpiceLevel"] == "medium"
    assert body["oauthProvider"] is None


def test_me_requires_token(client: TestClient) -> None:
    assert client.get(f"{API}/auth/me").status_code == 401


def test_register_duplicate_email_conflict(client: TestClient) -> None:
    assert register(client).status_code == 201
    res = register(client, email="KUMAR@example.com")
    assert res.status_code == 409
    assert res.json()["code"] == "EMAIL_TAKEN"


@pytest.mark.parametrize(
    ("overrides", "field"),
    [
        ({"role": "admin"}, "role"),
        ({"password": "short"}, "password"),
        ({"password": "அ" * 25}, "password"),  # 25 chars but 75 UTF-8 bytes
        ({"fullName": "   "}, "fullName"),
        ({"email": "not-an-email"}, "email"),
    ],
)
def test_register_validation(client: TestClient, overrides: dict[str, str], field: str) -> None:
    body = {"email": "a@example.com", "password": "supersecret1", "fullName": "A"}
    body.update(overrides)
    res = client.post(f"{API}/auth/register", json=body)
    assert res.status_code == 422
    assert res.json()["code"] == "VALIDATION_ERROR"
    assert any(field in err["loc"] for err in res.json()["errors"])


# --------------------------------------------------------------------------- #
# Login
# --------------------------------------------------------------------------- #


def test_login_success_and_failures_share_error(client: TestClient, db: Session) -> None:
    register(client)
    ok = client.post(
        f"{API}/auth/login", json={"email": "kumar@example.com", "password": "supersecret1"}
    )
    assert ok.status_code == 200
    assert ok.json()["tokenType"] == "bearer"

    wrong_pw = client.post(
        f"{API}/auth/login", json={"email": "kumar@example.com", "password": "nope-nope"}
    )
    unknown = client.post(
        f"{API}/auth/login", json={"email": "ghost@example.com", "password": "nope-nope"}
    )
    for res in (wrong_pw, unknown):
        assert res.status_code == 401
        assert res.json()["code"] == "INVALID_CREDENTIALS"
    assert wrong_pw.json()["detail"] == unknown.json()["detail"]

    # Inactive and OAuth-only accounts get the same answer.
    user = db.scalar(select(User).where(User.email == "kumar@example.com"))
    assert user is not None
    user.is_active = False
    db.add(User(email="oauth@example.com", full_name="O", oauth_provider="google"))
    db.commit()
    for email, pw in (("kumar@example.com", "supersecret1"), ("oauth@example.com", "whatever1")):
        res = client.post(f"{API}/auth/login", json={"email": email, "password": pw})
        assert res.status_code == 401
        assert res.json()["code"] == "INVALID_CREDENTIALS"


# --------------------------------------------------------------------------- #
# Refresh rotation / reuse detection / logout
# --------------------------------------------------------------------------- #


def test_refresh_rotates_and_detects_reuse(client: TestClient, db: Session) -> None:
    first = register(client).json()

    rotated = client.post(f"{API}/auth/refresh", json={"refreshToken": first["refreshToken"]})
    assert rotated.status_code == 200
    second = rotated.json()
    assert second["refreshToken"] != first["refreshToken"]

    # Old token is now revoked -> 401, and reuse revokes every token of the user.
    reused = client.post(f"{API}/auth/refresh", json={"refreshToken": first["refreshToken"]})
    assert reused.status_code == 401
    assert reused.json()["code"] == "INVALID_REFRESH_TOKEN"

    after_reuse = client.post(f"{API}/auth/refresh", json={"refreshToken": second["refreshToken"]})
    assert after_reuse.status_code == 401
    db.expire_all()
    assert all(row.revoked for row in db.scalars(select(RefreshToken)))


def test_refresh_unknown_token(client: TestClient) -> None:
    res = client.post(f"{API}/auth/refresh", json={"refreshToken": "does-not-exist"})
    assert res.status_code == 401
    assert res.json()["code"] == "INVALID_REFRESH_TOKEN"


def test_logout_revokes_and_is_idempotent(client: TestClient) -> None:
    tokens = register(client).json()
    res = client.post(f"{API}/auth/logout", json={"refreshToken": tokens["refreshToken"]})
    assert res.status_code == 204
    assert res.content == b""
    again = client.post(f"{API}/auth/logout", json={"refreshToken": tokens["refreshToken"]})
    assert again.status_code == 204
    unknown = client.post(f"{API}/auth/logout", json={"refreshToken": "unknown"})
    assert unknown.status_code == 204

    res = client.post(f"{API}/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
    assert res.status_code == 401


# --------------------------------------------------------------------------- #
# PUT /auth/me
# --------------------------------------------------------------------------- #


def test_update_me(client: TestClient) -> None:
    headers = bearer(register(client).json()["accessToken"])
    res = client.put(
        f"{API}/auth/me",
        headers=headers,
        json={
            "fullName": "  Kumar Raja ",
            "avatarUrl": "https://example.com/a.png",
            "defaultSpiceLevel": "mass",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["fullName"] == "Kumar Raja"
    assert body["avatarUrl"] == "https://example.com/a.png"
    assert body["defaultSpiceLevel"] == "mass"

    # Omitted fields unchanged; null fullName ignored; null avatar clears.
    res = client.put(f"{API}/auth/me", headers=headers, json={"fullName": None, "avatarUrl": None})
    assert res.status_code == 200
    assert res.json()["fullName"] == "Kumar Raja"
    assert res.json()["avatarUrl"] is None
    assert res.json()["defaultSpiceLevel"] == "mass"


@pytest.mark.parametrize(
    "body",
    [
        {"avatarUrl": "javascript:alert(1)"},
        {"avatarUrl": "https://example.com/" + "a" * 500},
        {"defaultSpiceLevel": "volcano"},
    ],
)
def test_update_me_validation(client: TestClient, body: dict[str, str]) -> None:
    headers = bearer(register(client).json()["accessToken"])
    assert client.put(f"{API}/auth/me", headers=headers, json=body).status_code == 422


# --------------------------------------------------------------------------- #
# Google OAuth
# --------------------------------------------------------------------------- #


def test_google_login_not_configured(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "")
    res = client.get(f"{API}/auth/google/login", follow_redirects=False)
    assert res.status_code == 400
    assert res.json()["code"] == "OAUTH_NOT_CONFIGURED"


class _FakeGoogleClient:
    def __init__(self, userinfo: dict[str, Any] | None, fail: bool = False) -> None:
        self._userinfo = userinfo
        self._fail = fail

    async def authorize_access_token(self, _request: Any) -> dict[str, Any]:
        if self._fail:
            raise OAuthError(error="mismatching_state")
        return {"access_token": "x", "userinfo": self._userinfo}


@pytest.fixture()
def google_configured(monkeypatch: pytest.MonkeyPatch) -> pytest.MonkeyPatch:
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "cid")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "secret")
    monkeypatch.setattr(settings, "FRONTEND_URL", "http://front.test/")
    return monkeypatch


def test_google_callback_creates_user(
    client: TestClient, db: Session, google_configured: pytest.MonkeyPatch
) -> None:
    fake = _FakeGoogleClient(
        {
            "email": "Priya@Gmail.com",
            "email_verified": True,
            "name": "Priya",
            "picture": "https://lh3.example/p.png",
        }
    )
    google_configured.setattr(google, "get_google_client", lambda: fake)

    res = client.get(f"{API}/auth/google/callback?code=c&state=s", follow_redirects=False)
    assert res.status_code == 302
    location = urlparse(res.headers["location"])
    assert f"{location.scheme}://{location.netloc}{location.path}" == (
        "http://front.test/auth/google/callback"
    )
    assert location.query == ""
    fragment = parse_qs(location.fragment)
    me = client.get(f"{API}/auth/me", headers=bearer(fragment["accessToken"][0]))
    body = me.json()
    assert body["email"] == "priya@gmail.com"
    assert body["role"] == "student"
    assert body["oauthProvider"] == "google"
    assert body["isVerified"] is True
    assert body["avatarUrl"] == "https://lh3.example/p.png"
    user = db.scalar(select(User).where(User.email == "priya@gmail.com"))
    assert user is not None and user.hashed_password is None
    refreshed = client.post(
        f"{API}/auth/refresh", json={"refreshToken": fragment["refreshToken"][0]}
    )
    assert refreshed.status_code == 200


def test_google_callback_links_existing_user(
    client: TestClient, db: Session, google_configured: pytest.MonkeyPatch
) -> None:
    register(client, role="instructor")
    fake = _FakeGoogleClient(
        {"email": "kumar@example.com", "email_verified": True, "name": "Other"}
    )
    google_configured.setattr(google, "get_google_client", lambda: fake)
    res = client.get(f"{API}/auth/google/callback", follow_redirects=False)
    assert res.status_code == 302
    assert "#accessToken=" in res.headers["location"]

    db.expire_all()
    user = db.scalar(select(User).where(User.email == "kumar@example.com"))
    assert user is not None
    assert user.oauth_provider == "google"
    assert user.is_verified is True
    assert user.role == UserRole.instructor
    assert user.full_name == "Kumar"
    # Password login still works after linking.
    login = client.post(
        f"{API}/auth/login", json={"email": "kumar@example.com", "password": "supersecret1"}
    )
    assert login.status_code == 200


@pytest.mark.parametrize(
    ("fake", "error"),
    [
        (_FakeGoogleClient(None, fail=True), "oauth_failed"),
        (_FakeGoogleClient({"email": "x@gmail.com", "email_verified": False}), "oauth_failed"),
        (_FakeGoogleClient({"email_verified": True}), "oauth_failed"),
    ],
)
def test_google_callback_failures_redirect(
    client: TestClient,
    google_configured: pytest.MonkeyPatch,
    fake: _FakeGoogleClient,
    error: str,
) -> None:
    google_configured.setattr(google, "get_google_client", lambda: fake)
    res = client.get(f"{API}/auth/google/callback", follow_redirects=False)
    assert res.status_code == 302
    assert res.headers["location"] == f"http://front.test/login?error={error}"


def test_google_callback_inactive_user(
    client: TestClient, db: Session, google_configured: pytest.MonkeyPatch
) -> None:
    db.add(User(email="gone@gmail.com", full_name="Gone", is_active=False))
    db.commit()
    fake = _FakeGoogleClient({"email": "gone@gmail.com", "email_verified": True})
    google_configured.setattr(google, "get_google_client", lambda: fake)
    res = client.get(f"{API}/auth/google/callback", follow_redirects=False)
    assert res.status_code == 302
    assert res.headers["location"] == "http://front.test/login?error=account_disabled"
