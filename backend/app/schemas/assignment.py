"""Assignment + rubric schemas (camelCase JSON, see ``frontend/src/types/assignment.ts``)."""

from datetime import UTC, datetime
from typing import Annotated, Self

from pydantic import Field, StringConstraints, field_validator, model_validator

from app.models.enums import ProgrammingLanguage
from app.schemas.base import CamelModel

MAX_RUBRIC_CRITERIA = 20

AssignmentTitle = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
]
AssignmentDescription = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20000)
]
MaxScore = Annotated[int, Field(ge=1, le=1000)]
MaxAttempts = Annotated[int, Field(ge=1, le=10)]


def _as_utc(value: datetime | None) -> datetime | None:
    """Treat naive datetimes as UTC so comparisons with stored values are consistent."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def _ensure_unique_names(criteria: list["RubricCriterionIn"]) -> None:
    """Raise ``ValueError`` if two criteria share a name (case-insensitive)."""
    seen: set[str] = set()
    for criterion in criteria:
        key = criterion.name.casefold()
        if key in seen:
            raise ValueError(f"Duplicate rubric criterion name: {criterion.name!r}")
        seen.add(key)


class RubricCriterionIn(CamelModel):
    """A rubric criterion as sent by the instructor (``RubricCriterionInput``)."""

    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""
    max_points: int = Field(gt=0, le=1000)
    position: int = Field(default=0, ge=0, le=1000)


class RubricCriterionOut(CamelModel):
    """A stored rubric criterion (``RubricCriterion``)."""

    id: int
    assignment_id: int
    name: str
    description: str
    max_points: int
    position: int


class AssignmentCreate(CamelModel):
    """Body of ``POST /courses/{id}/assignments``.

    The rubric (if any) may be a draft: its total is only enforced at publish time.
    """

    title: AssignmentTitle
    description: AssignmentDescription
    language: ProgrammingLanguage
    due_date: datetime | None = None
    max_score: MaxScore = 100
    max_attempts: MaxAttempts = 3
    allow_late: bool = False
    rubric_criteria: list[RubricCriterionIn] | None = Field(
        default=None, max_length=MAX_RUBRIC_CRITERIA
    )

    @field_validator("due_date")
    @classmethod
    def _due_date_utc(cls, value: datetime | None) -> datetime | None:
        return _as_utc(value)

    @model_validator(mode="after")
    def _unique_criteria(self) -> Self:
        if self.rubric_criteria:
            _ensure_unique_names(self.rubric_criteria)
        return self


_NON_NULLABLE_UPDATE_FIELDS = (
    "title",
    "description",
    "language",
    "max_score",
    "max_attempts",
    "allow_late",
)


class AssignmentUpdate(CamelModel):
    """Body of ``PUT /assignments/{id}`` (partial update; only sent fields change)."""

    title: AssignmentTitle | None = None
    description: AssignmentDescription | None = None
    language: ProgrammingLanguage | None = None
    due_date: datetime | None = None
    max_score: MaxScore | None = None
    max_attempts: MaxAttempts | None = None
    allow_late: bool | None = None

    @field_validator("due_date")
    @classmethod
    def _due_date_utc(cls, value: datetime | None) -> datetime | None:
        return _as_utc(value)

    @model_validator(mode="after")
    def _reject_nulls(self) -> Self:
        for field_name in _NON_NULLABLE_UPDATE_FIELDS:
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class RubricUpdate(CamelModel):
    """Body of ``PUT /assignments/{id}/rubric`` — replaces every criterion."""

    criteria: list[RubricCriterionIn] = Field(min_length=1, max_length=MAX_RUBRIC_CRITERIA)

    @model_validator(mode="after")
    def _unique_criteria(self) -> Self:
        _ensure_unique_names(self.criteria)
        return self


class AssignmentOut(CamelModel):
    """An assignment (``Assignment`` in the frontend).

    ``myAttemptsCount`` and ``myNextAttemptNumber`` are only serialised for students
    (omitted when ``None``). The next attempt number can exceed ``myAttemptsCount + 1``
    because refunded failed fetches keep their number but no longer count as attempts.
    """

    id: int
    course_id: int
    created_by: int
    title: str
    description: str
    language: ProgrammingLanguage
    due_date: datetime | None
    max_score: int
    max_attempts: int
    allow_late: bool
    is_published: bool
    rubric_criteria: list[RubricCriterionOut] = Field(default_factory=list)
    my_attempts_count: int | None = Field(default=None, exclude_if=lambda value: value is None)
    my_next_attempt_number: int | None = Field(default=None, exclude_if=lambda value: value is None)
    created_at: datetime
    updated_at: datetime


__all__ = [
    "MAX_RUBRIC_CRITERIA",
    "AssignmentCreate",
    "AssignmentOut",
    "AssignmentUpdate",
    "RubricCriterionIn",
    "RubricCriterionOut",
    "RubricUpdate",
]
