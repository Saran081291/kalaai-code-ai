"""Course business logic: CRUD, join codes, enrollments and student rosters."""

import logging
import secrets
from collections.abc import Iterable

from sqlalchemy import exists, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.exceptions import AppError, ConflictError, NotFoundError
from app.models import Course, CourseEnrollment, User
from app.schemas.course import CourseCreate, CourseOut, CourseStudent, CourseUpdate
from app.services.access import (
    ensure_course_member,
    ensure_course_owner,
    get_course_or_404,
    is_admin,
    is_course_owner,
    is_enrolled,
)

logger = logging.getLogger(__name__)

# Upper-case letters and digits minus the easily confused 0/O and 1/I.
JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
JOIN_CODE_LENGTH = 8
_MAX_JOIN_CODE_ATTEMPTS = 20


# --- Helpers -----------------------------------------------------------------
def _random_join_code() -> str:
    """Return a cryptographically random join code."""
    return "".join(secrets.choice(JOIN_CODE_ALPHABET) for _ in range(JOIN_CODE_LENGTH))


def generate_join_code(db: Session) -> str:
    """Generate a join code not used by any existing course.

    Raises:
        AppError: if no free code is found after several attempts (practically impossible).
    """
    for _ in range(_MAX_JOIN_CODE_ATTEMPTS):
        code = _random_join_code()
        if not db.scalar(select(exists().where(Course.join_code == code))):
            return code
    logger.error("Could not generate a unique join code after %d tries", _MAX_JOIN_CODE_ATTEMPTS)
    raise AppError("Could not generate a join code, please retry", code="JOIN_CODE_EXHAUSTED")


def student_counts(db: Session, course_ids: Iterable[int]) -> dict[int, int]:
    """Return ``{course_id: enrolled student count}`` using one grouped query."""
    ids = list(set(course_ids))
    if not ids:
        return {}
    stmt = (
        select(CourseEnrollment.course_id, func.count(CourseEnrollment.id))
        .where(CourseEnrollment.course_id.in_(ids))
        .group_by(CourseEnrollment.course_id)
    )
    return {course_id: count for course_id, count in db.execute(stmt)}


def to_course_out(
    db: Session, course: Course, user: User, student_count: int | None = None
) -> CourseOut:
    """Build the API representation of ``course`` for ``user``.

    Args:
        db: Database session (used to count students when ``student_count`` is not given).
        course: The course ORM object.
        user: The current user (drives ``isInstructor``).
        student_count: Pre-computed enrollment count, to avoid a query per course in lists.
    """
    if student_count is None:
        student_count = student_counts(db, [course.id]).get(course.id, 0)
    return CourseOut(
        id=course.id,
        instructor_id=course.instructor_id,
        name=course.name,
        description=course.description,
        join_code=course.join_code,
        is_archived=course.is_archived,
        is_instructor=is_course_owner(course, user),
        student_count=student_count,
        created_at=course.created_at,
        updated_at=course.updated_at,
    )


def get_owned_course(db: Session, course_id: int, user: User) -> Course:
    """Load a course and ensure ``user`` owns it (404 / 403 NOT_COURSE_OWNER)."""
    course = get_course_or_404(db, course_id)
    ensure_course_owner(course, user)
    return course


def get_member_course(db: Session, course_id: int, user: User) -> Course:
    """Load a course and ensure ``user`` owns or is enrolled in it (404 / 403)."""
    course = get_course_or_404(db, course_id)
    ensure_course_member(db, course, user)
    return course


# --- Use cases ---------------------------------------------------------------
def create_course(db: Session, user: User, data: CourseCreate) -> CourseOut:
    """Create a course taught by ``user`` with a fresh join code."""
    course = Course(
        instructor_id=user.id,
        name=data.name,
        description=data.description,
        join_code=generate_join_code(db),
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    logger.info("Course %s created by user %s", course.id, user.id)
    return to_course_out(db, course, user, student_count=0)


def list_courses(db: Session, user: User) -> list[CourseOut]:
    """Return non-archived courses the user teaches or attends (admins: all), newest first."""
    stmt = select(Course).where(Course.is_archived.is_(False))
    if not is_admin(user):
        enrolled = select(CourseEnrollment.course_id).where(CourseEnrollment.student_id == user.id)
        stmt = stmt.where(or_(Course.instructor_id == user.id, Course.id.in_(enrolled)))
    stmt = stmt.order_by(Course.created_at.desc(), Course.id.desc())
    courses = list(db.scalars(stmt))
    counts = student_counts(db, (c.id for c in courses))
    return [to_course_out(db, c, user, student_count=counts.get(c.id, 0)) for c in courses]


def get_course(db: Session, course_id: int, user: User) -> CourseOut:
    """Return one course visible to the user (owner, enrolled student or admin)."""
    course = get_member_course(db, course_id, user)
    return to_course_out(db, course, user)


def update_course(db: Session, course_id: int, user: User, data: CourseUpdate) -> CourseOut:
    """Apply a partial update to a course the user owns."""
    course = get_owned_course(db, course_id, user)
    if "name" in data.model_fields_set and data.name is not None:
        course.name = data.name
    if "description" in data.model_fields_set:
        course.description = data.description
    db.commit()
    db.refresh(course)
    return to_course_out(db, course, user)


def archive_course(db: Session, course_id: int, user: User) -> None:
    """Archive (soft-delete) a course the user owns. Idempotent."""
    course = get_owned_course(db, course_id, user)
    if not course.is_archived:
        course.is_archived = True
        db.commit()
        logger.info("Course %s archived by user %s", course.id, user.id)


def join_course(db: Session, user: User, join_code: str) -> CourseOut:
    """Enroll ``user`` in the course identified by ``join_code`` (case-insensitive).

    Raises:
        NotFoundError: INVALID_JOIN_CODE for unknown or archived courses.
        ConflictError: ALREADY_ENROLLED if already enrolled or the user teaches the course.
    """
    code = join_code.strip().upper()
    course = db.scalar(select(Course).where(Course.join_code == code))
    if course is None or course.is_archived:
        raise NotFoundError(
            "Invalid join code — check with your instructor", code="INVALID_JOIN_CODE"
        )
    if course.instructor_id == user.id:
        raise ConflictError("You teach this course — no need to join it", code="ALREADY_ENROLLED")
    if is_enrolled(db, course.id, user.id):
        raise ConflictError("You are already enrolled in this course", code="ALREADY_ENROLLED")

    db.add(CourseEnrollment(course_id=course.id, student_id=user.id))
    try:
        db.commit()
    except IntegrityError as exc:  # concurrent double-join
        db.rollback()
        raise ConflictError(
            "You are already enrolled in this course", code="ALREADY_ENROLLED"
        ) from exc
    logger.info("User %s joined course %s", user.id, course.id)
    return to_course_out(db, course, user)


def regenerate_join_code(db: Session, course_id: int, user: User) -> CourseOut:
    """Replace the join code of a course the user owns."""
    course = get_owned_course(db, course_id, user)
    course.join_code = generate_join_code(db)
    db.commit()
    db.refresh(course)
    return to_course_out(db, course, user)


def list_students(db: Session, course_id: int, user: User) -> list[CourseStudent]:
    """Return the enrolled students of a course the user owns, ordered by name."""
    get_owned_course(db, course_id, user)
    stmt = (
        select(User, CourseEnrollment.joined_at)
        .join(CourseEnrollment, CourseEnrollment.student_id == User.id)
        .where(CourseEnrollment.course_id == course_id)
        .order_by(func.lower(User.full_name), User.email, User.id)
    )
    return [
        CourseStudent(
            id=student.id,
            email=student.email,
            full_name=student.full_name,
            avatar_url=student.avatar_url,
            joined_at=joined_at,
        )
        for student, joined_at in db.execute(stmt)
    ]


__all__ = [
    "JOIN_CODE_ALPHABET",
    "JOIN_CODE_LENGTH",
    "archive_course",
    "create_course",
    "generate_join_code",
    "get_course",
    "get_member_course",
    "get_owned_course",
    "join_course",
    "list_courses",
    "list_students",
    "regenerate_join_code",
    "student_counts",
    "to_course_out",
    "update_course",
]
