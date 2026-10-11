"""Assignment + rubric business logic.

Rules:
- Only the course owner (or an admin) creates / edits / publishes / deletes assignments.
- Students see published assignments only, plus their own attempt count.
- A rubric may be a draft while unpublished; publishing requires >= 1 criterion and
  ``sum(maxPoints) == maxScore``. Once published, edits must keep that invariant.
"""

import logging
from collections.abc import Iterable

from sqlalchemy import delete, exists, func, select
from sqlalchemy.orm import Session, selectinload

from app.exceptions import BadRequestError, ConflictError, NotFoundError
from app.models import Assignment, Course, Review, RubricCriterion, Submission, User
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentOut,
    AssignmentUpdate,
    RubricCriterionIn,
)
from app.services.access import ensure_assignment_owner, get_assignment_for_user, is_course_owner
from app.services.course_service import get_member_course, get_owned_course

logger = logging.getLogger(__name__)


# --- Helpers -----------------------------------------------------------------
def attempt_counts(db: Session, student_id: int, assignment_ids: Iterable[int]) -> dict[int, int]:
    """Return ``{assignment_id: attempts used by student}`` in one grouped query.

    Submissions whose fetch failed (``attempt_refunded``) are not counted.
    """
    ids = list(set(assignment_ids))
    if not ids:
        return {}
    stmt = (
        select(Submission.assignment_id, func.count(Submission.id))
        .where(
            Submission.student_id == student_id,
            Submission.assignment_id.in_(ids),
            Submission.attempt_refunded.is_(False),
        )
        .group_by(Submission.assignment_id)
    )
    return {assignment_id: count for assignment_id, count in db.execute(stmt)}


def next_attempt_numbers(
    db: Session, student_id: int, assignment_ids: Iterable[int]
) -> dict[int, int]:
    """Return ``{assignment_id: attempt number the next submission will get}``.

    Mirrors the numbering in ``submission_service`` (highest attempt number + 1, refunded
    submissions included), so it can differ from ``attempts used + 1``. Assignments the
    student has not submitted to are omitted (their next number is 1).
    """
    ids = list(set(assignment_ids))
    if not ids:
        return {}
    stmt = (
        select(Submission.assignment_id, func.max(Submission.attempt_number))
        .where(Submission.student_id == student_id, Submission.assignment_id.in_(ids))
        .group_by(Submission.assignment_id)
    )
    return {assignment_id: int(last) + 1 for assignment_id, last in db.execute(stmt)}


def to_assignment_out(
    assignment: Assignment,
    my_attempts_count: int | None = None,
    my_next_attempt_number: int | None = None,
) -> AssignmentOut:
    """Build the API representation (``rubric_criteria`` should be loaded / loadable)."""
    out = AssignmentOut.model_validate(assignment)
    if my_attempts_count is not None:
        out.my_attempts_count = my_attempts_count
    if my_next_attempt_number is not None:
        out.my_next_attempt_number = my_next_attempt_number
    return out


def _out_for_user(db: Session, assignment: Assignment, user: User) -> AssignmentOut:
    """Serialise an assignment, adding ``myAttemptsCount`` for non-owners (students)."""
    if is_course_owner(assignment.course, user):
        return to_assignment_out(assignment)
    count = attempt_counts(db, user.id, [assignment.id]).get(assignment.id, 0)
    next_number = next_attempt_numbers(db, user.id, [assignment.id]).get(assignment.id, 1)
    return to_assignment_out(
        assignment, my_attempts_count=count, my_next_attempt_number=next_number
    )


def _rubric_mismatch(total: int, max_score: int, count: int) -> BadRequestError:
    """Build the RUBRIC_TOTAL_MISMATCH error with both numbers in the message."""
    if count == 0:
        detail = f"Add at least one rubric criterion (rubric total 0, max score {max_score})"
    else:
        detail = f"Rubric total ({total}) must equal the max score ({max_score})"
    return BadRequestError(detail, code="RUBRIC_TOTAL_MISMATCH")


def _ensure_rubric_matches(total: int, max_score: int, count: int) -> None:
    """Raise 400 RUBRIC_TOTAL_MISMATCH unless the rubric is non-empty and sums to max_score."""
    if count == 0 or total != max_score:
        raise _rubric_mismatch(total, max_score, count)


def _build_criteria(criteria: list[RubricCriterionIn]) -> list[RubricCriterion]:
    """Create unsaved criterion rows ordered by ``position`` (stable for ties)."""
    ordered = sorted(criteria, key=lambda c: c.position)
    return [
        RubricCriterion(
            name=c.name,
            description=c.description,
            max_points=c.max_points,
            position=c.position,
        )
        for c in ordered
    ]


def _get_owned_assignment(db: Session, assignment_id: int, user: User) -> Assignment:
    """Load an assignment and ensure the user owns its course (404 / 403 NOT_COURSE_OWNER)."""
    assignment = db.get(Assignment, assignment_id)
    if assignment is None:
        raise NotFoundError("Assignment not found")
    ensure_assignment_owner(assignment, user)
    return assignment


def _has_submissions(db: Session, assignment_id: int) -> bool:
    """Return True if any submission exists for the assignment."""
    return bool(db.scalar(select(exists().where(Submission.assignment_id == assignment_id))))


def _has_reviews(db: Session, assignment_id: int) -> bool:
    """Return True if any submission of the assignment has a review (references criteria)."""
    stmt = select(
        exists()
        .where(Review.submission_id == Submission.id)
        .where(Submission.assignment_id == assignment_id)
    )
    return bool(db.scalar(stmt))


# --- Use cases ---------------------------------------------------------------
def list_for_course(db: Session, course_id: int, user: User) -> list[AssignmentOut]:
    """List a course's assignments (students: published only, with ``myAttemptsCount``).

    Ordered by due date (undated last), then creation time.
    """
    course = get_member_course(db, course_id, user)
    owner = is_course_owner(course, user)
    stmt = (
        select(Assignment)
        .options(selectinload(Assignment.rubric_criteria))
        .where(Assignment.course_id == course.id)
        .order_by(
            Assignment.due_date.is_(None),
            Assignment.due_date,
            Assignment.created_at,
            Assignment.id,
        )
    )
    if not owner:
        stmt = stmt.where(Assignment.is_published.is_(True))
    assignments = list(db.scalars(stmt))
    if owner:
        return [to_assignment_out(a) for a in assignments]
    counts = attempt_counts(db, user.id, [a.id for a in assignments])
    next_numbers = next_attempt_numbers(db, user.id, [a.id for a in assignments])
    return [
        to_assignment_out(
            a,
            my_attempts_count=counts.get(a.id, 0),
            my_next_attempt_number=next_numbers.get(a.id, 1),
        )
        for a in assignments
    ]


def create_assignment(
    db: Session, course_id: int, user: User, data: AssignmentCreate
) -> AssignmentOut:
    """Create an unpublished assignment (optionally with a draft rubric) in an owned course."""
    course: Course = get_owned_course(db, course_id, user)
    if course.is_archived:
        raise BadRequestError(
            "This course is archived — assignments cannot be added", code="COURSE_ARCHIVED"
        )
    assignment = Assignment(
        course_id=course.id,
        created_by=user.id,
        title=data.title,
        description=data.description,
        language=data.language,
        due_date=data.due_date,
        max_score=data.max_score,
        max_attempts=data.max_attempts,
        allow_late=data.allow_late,
        is_published=False,
    )
    assignment.rubric_criteria = _build_criteria(data.rubric_criteria or [])
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    logger.info("Assignment %s created in course %s by user %s", assignment.id, course.id, user.id)
    return to_assignment_out(assignment)


def get_assignment(db: Session, assignment_id: int, user: User) -> AssignmentOut:
    """Return an assignment visible to the user (students: published only)."""
    assignment = get_assignment_for_user(db, assignment_id, user)
    return _out_for_user(db, assignment, user)


def update_assignment(
    db: Session, assignment_id: int, user: User, data: AssignmentUpdate
) -> AssignmentOut:
    """Partially update an assignment the user owns.

    Changing ``maxScore`` on a published assignment must keep the rubric total equal to it.
    """
    assignment = _get_owned_assignment(db, assignment_id, user)
    fields = data.model_dump(exclude_unset=True)

    new_max = fields.get("max_score")
    if assignment.is_published and new_max is not None and new_max != assignment.max_score:
        criteria = assignment.rubric_criteria
        _ensure_rubric_matches(sum(c.max_points for c in criteria), new_max, len(criteria))

    for field_name, value in fields.items():
        setattr(assignment, field_name, value)
    db.commit()
    db.refresh(assignment)
    return to_assignment_out(assignment)


def delete_assignment(db: Session, assignment_id: int, user: User) -> None:
    """Delete an owned assignment that has no submissions (409 HAS_SUBMISSIONS otherwise)."""
    assignment = _get_owned_assignment(db, assignment_id, user)
    if _has_submissions(db, assignment.id):
        raise ConflictError(
            "This assignment already has submissions and cannot be deleted",
            code="HAS_SUBMISSIONS",
        )
    db.execute(delete(RubricCriterion).where(RubricCriterion.assignment_id == assignment.id))
    db.delete(assignment)
    db.commit()
    logger.info("Assignment %s deleted by user %s", assignment_id, user.id)


def publish_assignment(db: Session, assignment_id: int, user: User) -> AssignmentOut:
    """Publish an owned assignment once its rubric sums to ``maxScore``. Idempotent."""
    assignment = _get_owned_assignment(db, assignment_id, user)
    if not assignment.is_published:
        criteria = assignment.rubric_criteria
        _ensure_rubric_matches(
            sum(c.max_points for c in criteria), assignment.max_score, len(criteria)
        )
        assignment.is_published = True
        db.commit()
        db.refresh(assignment)
        logger.info("Assignment %s published by user %s", assignment.id, user.id)
    return to_assignment_out(assignment)


def replace_rubric(
    db: Session, assignment_id: int, user: User, criteria: list[RubricCriterionIn]
) -> AssignmentOut:
    """Replace every rubric criterion of an owned assignment.

    Raises:
        BadRequestError: RUBRIC_TOTAL_MISMATCH if published and the new total != maxScore.
        ConflictError: HAS_SUBMISSIONS if reviews already reference the current criteria.
    """
    assignment = _get_owned_assignment(db, assignment_id, user)
    if assignment.is_published:
        _ensure_rubric_matches(
            sum(c.max_points for c in criteria), assignment.max_score, len(criteria)
        )
    if _has_reviews(db, assignment.id):
        raise ConflictError(
            "Submissions have already been reviewed against this rubric — it cannot be replaced",
            code="HAS_SUBMISSIONS",
        )
    assignment.rubric_criteria.clear()
    db.flush()
    assignment.rubric_criteria.extend(_build_criteria(criteria))
    db.commit()
    db.refresh(assignment)
    return to_assignment_out(assignment)


__all__ = [
    "attempt_counts",
    "next_attempt_numbers",
    "create_assignment",
    "delete_assignment",
    "get_assignment",
    "list_for_course",
    "publish_assignment",
    "replace_rubric",
    "to_assignment_out",
    "update_assignment",
]
