"""Course leaderboard: sum of each student's best effective score per assignment.

Definition (per course):
- effective score of a review = ``COALESCE(instructor_override_score, total_score)``
- for each enrolled student and each assignment, take the BEST (MAX) effective score
  across that student's reviewed submissions (attempts)
- ``totalScore`` = sum of those bests; ``assignmentsCompleted`` = assignments with >= 1 review
- every enrolled student is listed, including those with no reviews (0 / 0)
- standard competition ranking (1, 1, 3) by ``totalScore`` desc; ties ordered by name

Implemented as a single aggregate SQL statement that runs on SQLite and PostgreSQL.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Assignment, CourseEnrollment, Review, Submission, User
from app.schemas.wall import LeaderboardEntry


def compute_leaderboard(db: Session, course_id: int) -> list[LeaderboardEntry]:
    """Compute the ranked leaderboard for a course.

    Args:
        db: Database session
        course_id: Course to rank

    Returns:
        Entries ordered by rank (then student name, then id). Access control is the
        caller's responsibility.
    """
    effective = func.coalesce(Review.instructor_override_score, Review.total_score)
    best_per_assignment = (
        select(
            Submission.student_id.label("student_id"),
            Submission.assignment_id.label("assignment_id"),
            func.max(effective).label("best_score"),
        )
        .join(Review, Review.submission_id == Submission.id)
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .where(Assignment.course_id == course_id)
        .group_by(Submission.student_id, Submission.assignment_id)
        .subquery("best_per_assignment")
    )
    totals = (
        select(
            best_per_assignment.c.student_id,
            func.sum(best_per_assignment.c.best_score).label("total_score"),
            func.count(best_per_assignment.c.assignment_id).label("assignments_completed"),
        )
        .group_by(best_per_assignment.c.student_id)
        .subquery("student_totals")
    )
    total_score = func.coalesce(totals.c.total_score, 0)
    stmt = (
        select(
            User.id,
            User.full_name,
            User.avatar_url,
            total_score.label("total_score"),
            func.coalesce(totals.c.assignments_completed, 0).label("assignments_completed"),
        )
        .select_from(CourseEnrollment)
        .join(User, User.id == CourseEnrollment.student_id)
        .outerjoin(totals, totals.c.student_id == User.id)
        .where(CourseEnrollment.course_id == course_id)
        .order_by(total_score.desc(), User.full_name.asc(), User.id.asc())
    )

    entries: list[LeaderboardEntry] = []
    previous_score: int | None = None
    rank = 0
    for position, row in enumerate(db.execute(stmt).all(), start=1):
        score = int(row.total_score)
        if score != previous_score:
            rank = position
            previous_score = score
        entries.append(
            LeaderboardEntry(
                rank=rank,
                student_id=row.id,
                student_name=row.full_name,
                avatar_url=row.avatar_url,
                total_score=score,
                assignments_completed=int(row.assignments_completed),
            )
        )
    return entries


__all__ = ["compute_leaderboard"]
