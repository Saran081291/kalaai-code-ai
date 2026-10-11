"""Course request/response schemas (camelCase JSON, see ``frontend/src/types/course.ts``)."""

from datetime import datetime
from typing import Annotated, Self

from pydantic import Field, StringConstraints, field_validator, model_validator

from app.schemas.base import CamelModel

CourseName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
CourseDescription = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]


def _blank_to_none(value: str | None) -> str | None:
    """Store empty / whitespace-only descriptions as ``NULL``."""
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


class CourseCreate(CamelModel):
    """Body of ``POST /courses``."""

    name: CourseName
    description: CourseDescription | None = None

    @field_validator("description")
    @classmethod
    def _normalise_description(cls, value: str | None) -> str | None:
        return _blank_to_none(value)


class CourseUpdate(CamelModel):
    """Body of ``PUT /courses/{id}`` (partial update; only sent fields change)."""

    name: CourseName | None = None
    description: CourseDescription | None = None

    @field_validator("description")
    @classmethod
    def _normalise_description(cls, value: str | None) -> str | None:
        return _blank_to_none(value)

    @model_validator(mode="after")
    def _name_not_null(self) -> Self:
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("name cannot be null")
        return self


class CourseJoin(CamelModel):
    """Body of ``POST /courses/join``. The code is matched case-insensitively."""

    join_code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)]

    @field_validator("join_code")
    @classmethod
    def _upper(cls, value: str) -> str:
        return value.upper()


class CourseOut(CamelModel):
    """A course as seen by the current user (``Course`` in the frontend)."""

    id: int
    instructor_id: int
    name: str
    description: str | None
    join_code: str
    is_archived: bool
    is_instructor: bool = Field(description="True when the current user teaches this course")
    student_count: int = 0
    created_at: datetime
    updated_at: datetime


class CourseStudent(CamelModel):
    """Row of ``GET /courses/{id}/students``."""

    id: int
    email: str
    full_name: str | None
    avatar_url: str | None
    joined_at: datetime


__all__ = ["CourseCreate", "CourseJoin", "CourseOut", "CourseStudent", "CourseUpdate"]
