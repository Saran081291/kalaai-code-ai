"""Role-based dashboard aggregation for ``GET /dashboard``.

Query budget (independent of data size):

- Student: 1 (upcoming) + 1 (recent results, eager-loaded) + 1 (enrolled courses
  with enrollment counts) + one ``compute_leaderboard`` call per enrolled course.
- Instructor/admin: 1 (recent) + 1 (failed), both eager-loaded, + 1 (course stats
  via grouped sub-queries).
"""

import logging
from collections.abc import Sequence
from typing import Any

from sqlalchemy import Select, and_, case, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models import (
    Assignment,
    Course,
    CourseEnrollment,
    Submission,
    SubmissionStatus,
    User,
    UserRole,
)
from app.models.base import utcnow
from app.schemas.dashboard import (
    CourseRank,
    CourseStat,
    InstructorDashboard,
    StudentDashboard,
    UpcomingAssignment,
)
from app.schemas.submission import SubmissionOut
from app.schemas.wall import LeaderboardEntry
from app.services.leaderboard_service import compute_leaderboard
from app.services.submission_service import to_submission_out

logger = logging.getLogger(__name__)

UPCOMING_LIMIT = 5
RECENT_RESULTS_LIMIT = 5
RECENT_SUBMISSIONS_LIMIT = 10
FAILED_SUBMISSIONS_LIMIT = 10

IN_PROGRESS_STATUSES: tuple[SubmissionStatus, ...] = (
    SubmissionStatus.pending,
    SubmissionStatus.fetching,
    SubmissionStatus.reviewing,
    SubmissionStatus.roasting,
)


def get_dashboard(db: Session, user: User) -> StudentDashboard | InstructorDashboard:
    """Build the dashboard for ``user``; admins get the instructor view."""
    if user.role == UserRole.student:
        return get_student_dashboard(db, user)
    return get_instructor_dashboard(db, user)


# --------------------------------------------------------------------------- #
# Shared helpers
# --------------------------------------------------------------------------- #


def _submissions_with_relations() -> Select[Any]:
    """Base ``select(Submission)`` with everything ``to_submission_out`` needs loaded."""
    return select(Submission).options(
        joinedload(Submission.assignment).joinedload(Assignment.course),
        joinedload(Submission.student),
        joinedload(Submission.review),
    )


def _to_outs(submissions: Sequence[Submission]) -> list[SubmissionOut]:
    """Convert loaded submissions to denormalised ``SubmissionOut`` objects."""
    return [to_submission_out(submission) for submission in submissions]


def _latest(db: Session, stmt: Select[Any], limit: int) -> list[SubmissionOut]:
    """Run ``stmt`` newest-first, capped at ``limit``, and convert to ``SubmissionOut``."""
    ordered = stmt.order_by(Submission.submitted_at.desc(), Submission.id.desc()).limit(limit)
    return _to_outs(db.scalars(ordered).unique().all())


# --------------------------------------------------------------------------- #
# Student
# --------------------------------------------------------------------------- #


def get_student_dashboard(db: Session, user: User) -> StudentDashboard:
    """Upcoming assignments, latest results and per-course ranks for a student."""
    return StudentDashboard(
        upcoming_assignments=_upcoming_assignments(db, user.id),
        recent_results=_recent_results(db, user.id),
        ranks=_course_ranks(db, user.id),
    )


def _upcoming_assignments(db: Session, student_id: int) -> list[UpcomingAssignment]:
    """Published assignments in enrolled, active courses the student can still work on.

    Excludes assignments with a completed submission, with no attempts left, or
    past due (unless late submissions are allowed). Ordered by due date, nulls last.
    """
    stats = (
        select(
            Submission.assignment_id.label("assignment_id"),
            func.count(Submission.id).label("attempts_used"),
            func.sum(case((Submission.status == SubmissionStatus.completed, 1), else_=0)).label(
                "completed_count"
            ),
        )
        .where(Submission.student_id == student_id, Submission.attempt_refunded.is_(False))
        .group_by(Submission.assignment_id)
        .subquery()
    )
    attempts_used = func.coalesce(stats.c.attempts_used, 0)
    now = utcnow()

    stmt = (
        select(
            Assignment.id,
            Assignment.title,
            Assignment.course_id,
            Course.name,
            Assignment.due_date,
            attempts_used.label("attempts_used"),
            Assignment.max_attempts,
        )
        .join(Course, Course.id == Assignment.course_id)
        .join(
            CourseEnrollment,
            and_(
                CourseEnrollment.course_id == Course.id,
                CourseEnrollment.student_id == student_id,
            ),
        )
        .outerjoin(stats, stats.c.assignment_id == Assignment.id)
        .where(
            Assignment.is_published.is_(True),
            Course.is_archived.is_(False),
            func.coalesce(stats.c.completed_count, 0) == 0,
            attempts_used < Assignment.max_attempts,
            or_(
                Assignment.due_date.is_(None),
                Assignment.due_date >= now,
                Assignment.allow_late.is_(True),
            ),
        )
        .order_by(
            Assignment.due_date.is_(None),  # False (has a date) sorts first → nulls last
            Assignment.due_date.asc(),
            Assignment.id.asc(),
        )
        .limit(UPCOMING_LIMIT)
    )
    return [
        UpcomingAssignment(
            id=row.id,
            title=row.title,
            course_id=row.course_id,
            course_name=row.name,
            due_date=row.due_date,
            attempts_used=int(row.attempts_used),
            max_attempts=row.max_attempts,
        )
        for row in db.execute(stmt)
    ]


def _recent_results(db: Session, student_id: int) -> list[SubmissionOut]:
    """The student's latest submissions (any status), newest first."""
    stmt = _submissions_with_relations().where(Submission.student_id == student_id)
    return _latest(db, stmt, RECENT_RESULTS_LIMIT)


def _course_ranks(db: Session, student_id: int) -> list[CourseRank]:
    """One rank card per enrolled (non-archived) course."""
    enrollment_counts = (
        select(
            CourseEnrollment.course_id.label("course_id"),
            func.count(CourseEnrollment.id).label("student_count"),
        )
        .group_by(CourseEnrollment.course_id)
        .subquery()
    )
    stmt = (
        select(
            Course.id,
            Course.name,
            func.coalesce(enrollment_counts.c.student_count, 0).label("student_count"),
        )
        .join(
            CourseEnrollment,
            and_(
                CourseEnrollment.course_id == Course.id,
                CourseEnrollment.student_id == student_id,
            ),
        )
        .outerjoin(enrollment_counts, enrollment_counts.c.course_id == Course.id)
        .where(Course.is_archived.is_(False))
        .order_by(Course.name.asc(), Course.id.asc())
    )

    ranks: list[CourseRank] = []
    for row in db.execute(stmt).all():
        rank: int | None = None
        total_score = 0
        entry = _find_entry(compute_leaderboard(db, row.id), student_id)
        if entry is not None:
            total_score = entry.total_score
            if total_score > 0 or entry.assignments_completed > 0:
                rank = entry.rank
        ranks.append(
            CourseRank(
                course_id=row.id,
                course_name=row.name,
                rank=rank,
                total_students=int(row.student_count),
                total_score=total_score,
            )
        )
    return ranks


def _find_entry(entries: Sequence[LeaderboardEntry], student_id: int) -> LeaderboardEntry | None:
    """Return the leaderboard entry for ``student_id`` (or ``None``)."""
    for entry in entries:
        if entry.student_id == student_id:
            return entry
    return None


# --------------------------------------------------------------------------- #
# Instructor / admin
# --------------------------------------------------------------------------- #


def get_instructor_dashboard(db: Session, user: User) -> InstructorDashboard:
    """Recent + failed submissions and per-course stats; admins see every course."""
    is_admin = user.role == UserRole.admin

    scoped = _submissions_with_relations()
    if not is_admin:
        owned_assignment_ids = (
            select(Assignment.id)
            .join(Course, Course.id == Assignment.course_id)
            .where(Course.instructor_id == user.id)
        )
        scoped = scoped.where(Submission.assignment_id.in_(owned_assignment_ids))

    failed = scoped.where(Submission.status == SubmissionStatus.failed)
    return InstructorDashboard(
        recent_submissions=_latest(db, scoped, RECENT_SUBMISSIONS_LIMIT),
        failed_submissions=_latest(db, failed, FAILED_SUBMISSIONS_LIMIT),
        course_stats=_course_stats(db, None if is_admin else user.id),
    )


def _course_stats(db: Session, instructor_id: int | None) -> list[CourseStat]:
    """Per-course counts for non-archived courses (all courses when ``instructor_id`` is None)."""
    students = (
        select(
            CourseEnrollment.course_id.label("course_id"),
            func.count(CourseEnrollment.id).label("n"),
        )
        .group_by(CourseEnrollment.course_id)
        .subquery()
    )
    assignments = (
        select(Assignment.course_id.label("course_id"), func.count(Assignment.id).label("n"))
        .group_by(Assignment.course_id)
        .subquery()
    )
    submissions = (
        select(
            Assignment.course_id.label("course_id"),
            func.count(Submission.id).label("n"),
            func.sum(case((Submission.status.in_(IN_PROGRESS_STATUSES), 1), else_=0)).label(
                "in_progress"
            ),
        )
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .group_by(Assignment.course_id)
        .subquery()
    )

    stmt = (
        select(
            Course.id,
            Course.name,
            func.coalesce(students.c.n, 0).label("student_count"),
            func.coalesce(assignments.c.n, 0).label("assignment_count"),
            func.coalesce(submissions.c.n, 0).label("submission_count"),
            func.coalesce(submissions.c.in_progress, 0).label("in_progress_count"),
        )
        .outerjoin(students, students.c.course_id == Course.id)
        .outerjoin(assignments, assignments.c.course_id == Course.id)
        .outerjoin(submissions, submissions.c.course_id == Course.id)
        .where(Course.is_archived.is_(False))
        .order_by(Course.created_at.desc(), Course.id.desc())
    )
    if instructor_id is not None:
        stmt = stmt.where(Course.instructor_id == instructor_id)

    return [
        CourseStat(
            course_id=row.id,
            course_name=row.name,
            student_count=int(row.student_count),
            assignment_count=int(row.assignment_count),
            submission_count=int(row.submission_count),
            in_progress_count=int(row.in_progress_count),
        )
        for row in db.execute(stmt)
    ]


__all__ = [
    "get_dashboard",
    "get_instructor_dashboard",
    "get_student_dashboard",
]
