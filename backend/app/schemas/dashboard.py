"""Dashboard response schemas (``GET /dashboard``).

The response is a discriminated union on ``role``: students get a
``StudentDashboard``; instructors *and admins* get an ``InstructorDashboard``.
Field names mirror ``frontend/src/types/dashboard.ts`` (camelCase via ``CamelModel``).
"""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field

from app.schemas.base import CamelModel
from app.schemas.submission import SubmissionOut


class UpcomingAssignment(CamelModel):
    """A published assignment the student still has to finish."""

    id: int
    title: str
    course_id: int
    course_name: str
    due_date: datetime | None
    attempts_used: int
    max_attempts: int


class CourseRank(CamelModel):
    """The student's position on one course leaderboard (``rank`` null until scored)."""

    course_id: int
    course_name: str
    rank: int | None
    total_students: int
    total_score: int


class CourseStat(CamelModel):
    """Per-course counts shown to instructors."""

    course_id: int
    course_name: str
    student_count: int
    assignment_count: int
    submission_count: int
    in_progress_count: int


class StudentDashboard(CamelModel):
    """Dashboard payload for students."""

    role: Literal["student"] = "student"
    upcoming_assignments: list[UpcomingAssignment]
    recent_results: list[SubmissionOut]
    ranks: list[CourseRank]


class InstructorDashboard(CamelModel):
    """Dashboard payload for instructors (also returned to admins)."""

    role: Literal["instructor"] = "instructor"
    recent_submissions: list[SubmissionOut]
    failed_submissions: list[SubmissionOut]
    course_stats: list[CourseStat]


DashboardResponse = Annotated[
    StudentDashboard | InstructorDashboard,
    Field(discriminator="role"),
]

__all__ = [
    "CourseRank",
    "CourseStat",
    "DashboardResponse",
    "InstructorDashboard",
    "StudentDashboard",
    "UpcomingAssignment",
]
