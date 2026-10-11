"""Base schema types shared by every module."""

from datetime import UTC, datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, field_validator
from pydantic.alias_generators import to_camel

T = TypeVar("T")


class CamelModel(BaseModel):
    """Base model: snake_case in Python, camelCase in JSON, ORM-friendly."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    @field_validator("*", mode="after")
    @classmethod
    def _assume_utc(cls, value: Any) -> Any:
        """Treat naive datetimes (e.g. read back from SQLite) as UTC so JSON carries an offset."""
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value


class Page(CamelModel, Generic[T]):
    """Paginated list response: ``{items, total, page, pageSize}``.

    Usage: ``response_model=Page[CourseResponse]``.
    """

    items: list[T]
    total: int
    page: int
    page_size: int


class ErrorResponse(CamelModel):
    """Standard error body: ``{"detail": "...", "code": "MACHINE_CODE"}``."""

    detail: str
    code: str


class MessageResponse(CamelModel):
    """Simple acknowledgement body: ``{"message": "..."}``."""

    message: str
