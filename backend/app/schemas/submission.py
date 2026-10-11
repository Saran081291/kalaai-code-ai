"""Submission response schemas (camelCase JSON, mirrors ``frontend/src/types/submission.ts``)."""

from datetime import datetime

from app.models.enums import SourceType, SpiceLevel, SubmissionStatus
from app.schemas.base import CamelModel


class SubmissionOut(CamelModel):
    """A submission attempt plus denormalised course/assignment/student/score fields.

    Build it with ``app.services.submission_service.to_submission_out``.
    """

    id: int
    assignment_id: int
    student_id: int
    attempt_number: int
    source_type: SourceType
    github_url: str | None
    commit_sha: str | None
    spice_level: SpiceLevel
    status: SubmissionStatus
    error_message: str | None
    is_late: bool
    submitted_at: datetime
    created_at: datetime
    updated_at: datetime
    # Denormalised
    student_name: str | None = None
    assignment_title: str
    course_id: int
    course_name: str
    effective_score: int | None = None
    max_score: int


class SubmissionFileOut(CamelModel):
    """One captured source file of a submission."""

    id: int
    submission_id: int
    path: str
    language: str | None
    size_bytes: int
    content: str
    created_at: datetime


__all__ = ["SubmissionFileOut", "SubmissionOut"]
