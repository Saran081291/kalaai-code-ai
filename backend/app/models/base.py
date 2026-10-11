"""Reusable model mixins and column-type helpers."""

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, false, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import TypeEngine

# JSON column type: JSONB on PostgreSQL, generic JSON elsewhere (SQLite in tests).
JSONType: TypeEngine[Any] = JSON().with_variant(JSONB(), "postgresql")


def utcnow() -> datetime:
    """Return the current timezone-aware UTC datetime."""
    return datetime.now(UTC)


def str_enum(enum_cls: type[StrEnum]) -> SAEnum:
    """Build a portable, non-native enum column type storing the enum *values*.

    Rendered as VARCHAR(20) (no CHECK constraint) on every backend, so it works
    identically on PostgreSQL and SQLite. Values are validated on the Python side.
    """
    return SAEnum(
        enum_cls,
        native_enum=False,
        length=20,
        values_callable=lambda e: [m.value for m in e],
        validate_strings=True,
    )


class TimestampMixin:
    """Adds ``created_at`` and ``updated_at`` timezone-aware timestamps."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        server_default=func.now(),
        onupdate=utcnow,
    )


class SoftDeleteMixin:
    """Adds soft-delete flags (``is_deleted`` / ``deleted_at``)."""

    is_deleted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


__all__ = ["JSONType", "SoftDeleteMixin", "TimestampMixin", "str_enum", "utcnow"]
