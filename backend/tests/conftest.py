"""Shared pytest fixtures (SQLite, no Docker/PostgreSQL, no network, no real AI).

Existing per-module test files keep their own local ``db``/``client`` fixtures (which take
precedence over these); new tests should use the fixtures below.
"""

from collections.abc import Callable, Iterator
from itertools import count
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.auth.security import create_access_token, hash_password
from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models import User, UserRole
from app.rate_limit import limiter
from app.services import pipeline

_user_seq = count(1)

SessionFactory = sessionmaker[Session]
UserFactory = Callable[..., User]


@pytest.fixture()
def engine(tmp_path: Path) -> Iterator[Engine]:
    """A fresh file-backed SQLite engine (foreign keys on) with all tables created."""
    eng = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False}
    )

    @event.listens_for(eng, "connect")
    def _fk_on(dbapi_connection: Any, _record: Any) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture()
def session_factory(engine: Engine) -> SessionFactory:
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture()
def upload_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point ``settings.UPLOAD_DIR`` at a temp directory."""
    path = tmp_path / "uploads"
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(path))
    return path


@pytest.fixture()
def db(session_factory: SessionFactory) -> Iterator[Session]:
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(
    session_factory: SessionFactory,
    upload_dir: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[TestClient]:
    """TestClient on the real app: ``get_db`` overridden, rate limiter off, tmp uploads.

    The pipeline's own session factory is pointed at the same SQLite database so background
    tasks (run synchronously by TestClient) see the data.
    """

    def _override_get_db() -> Iterator[Session]:
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    monkeypatch.setattr(limiter, "enabled", False)
    monkeypatch.setattr(pipeline, "SessionLocal", session_factory)
    app.dependency_overrides[get_db] = _override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture()
def make_user(db: Session) -> UserFactory:
    """Factory creating a persisted user (unique email, bcrypt password ``password123``)."""

    def _make(
        role: UserRole = UserRole.student, *, full_name: str | None = None, email: str | None = None
    ) -> User:
        n = next(_user_seq)
        user = User(
            email=email or f"user{n}@example.com",
            full_name=full_name or f"User {n}",
            role=role,
            hashed_password=hash_password("password123"),
        )
        db.add(user)
        db.commit()
        return user

    return _make


def auth_headers_for(user: User) -> dict[str, str]:
    """Bearer header carrying a valid access token for ``user``."""
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}


@pytest.fixture()
def auth_headers() -> Callable[[User], dict[str, str]]:
    return auth_headers_for
