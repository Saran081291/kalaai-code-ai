"""Database engine, session factory, declarative Base and FastAPI dependency."""

from collections.abc import Generator
from typing import Any

from sqlalchemy import MetaData, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# Deterministic constraint/index names so Alembic migrations (and SQLite batch
# mode) can reference constraints by name across environments.
NAMING_CONVENTION: dict[str, str] = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Declarative base class shared by every ORM model."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def normalize_database_url(database_url: str) -> str:
    """Pin driverless PostgreSQL URLs to psycopg2 (the driver in requirements.txt).

    SQLAlchemy 2.1 changed the default ``postgresql://`` driver to psycopg (v3);
    rewriting ``postgresql://`` / ``postgres://`` to ``postgresql+psycopg2://``
    keeps the documented ``DATABASE_URL`` format working on SQLAlchemy 2.0 and 2.1.
    URLs that already name a driver are returned unchanged.
    """
    for prefix in ("postgresql://", "postgres://"):
        if database_url.startswith(prefix):
            return "postgresql+psycopg2://" + database_url[len(prefix) :]
    return database_url


def _engine_kwargs(database_url: str) -> dict[str, Any]:
    """Return engine keyword arguments appropriate for the given database URL."""
    kwargs: dict[str, Any] = {"pool_pre_ping": True}
    if database_url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    return kwargs


DATABASE_URL: str = normalize_database_url(settings.DATABASE_URL)

engine = create_engine(DATABASE_URL, **_engine_kwargs(DATABASE_URL))

if DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection: Any, _record: Any) -> None:
        """Enforce FK constraints and ON DELETE CASCADE on SQLite (matches PostgreSQL)."""
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """Yield a database session and always close it afterwards (FastAPI dependency)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


__all__ = [
    "DATABASE_URL",
    "NAMING_CONVENTION",
    "Base",
    "SessionLocal",
    "engine",
    "get_db",
    "normalize_database_url",
]
