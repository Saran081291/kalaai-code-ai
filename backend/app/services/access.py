"""Shared ownership / membership checks used by every module.

Rules:
- Admins can access everything.
- A course's instructor (``course.instructor_id``) owns the course and everything in it.
- Enrolled students are course members; they only see published assignments
  and only their own submissions.
"""

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.exceptions import ForbiddenError, NotFoundError
from app.models import (
    Assignment,
    Course,
    CourseEnrollment,
    Review,
    Roast,
    Submission,
    User,
    UserRole,
)


def is_admin(user: User) -> bool:
    """Return True if the user is a platform admin."""
    return user.role == UserRole.admin


def is_course_owner(course: Course, user: User) -> bool:
    """Return True if the user teaches the course (or is an admin)."""
    return is_admin(user) or course.instructor_id == user.id


def is_enrolled(db: Session, course_id: int, user_id: int) -> bool:
    """Return True if the user is enrolled as a student in the course."""
    stmt = select(
        exists().where(
            CourseEnrollment.course_id == course_id, CourseEnrollment.student_id == user_id
        )
    )
    return bool(db.scalar(stmt))


def is_course_member(db: Session, course: Course, user: User) -> bool:
    """Return True if the user owns the course or is enrolled in it."""
    return is_course_owner(course, user) or is_enrolled(db, course.id, user.id)


def get_course_or_404(db: Session, course_id: int) -> Course:
    """Load a course by id or raise 404."""
    course = db.get(Course, course_id)
    if course is None:
        raise NotFoundError("Course not found")
    return course


def ensure_course_owner(course: Course, user: User) -> None:
    """Raise 403 unless the user owns the course."""
    if not is_course_owner(course, user):
        raise ForbiddenError("Only the course instructor can do this", code="NOT_COURSE_OWNER")


def ensure_course_member(db: Session, course: Course, user: User) -> None:
    """Raise 403 unless the user owns or is enrolled in the course."""
    if not is_course_member(db, course, user):
        raise ForbiddenError("You are not a member of this course", code="NOT_COURSE_MEMBER")


def get_assignment_for_user(db: Session, assignment_id: int, user: User) -> Assignment:
    """Load an assignment visible to the user.

    Owners see everything; enrolled students see published assignments only.
    Raises 404 if missing or unpublished (for students), 403 if not a member.
    """
    assignment = db.get(Assignment, assignment_id)
    if assignment is None:
        raise NotFoundError("Assignment not found")
    course = assignment.course
    if is_course_owner(course, user):
        return assignment
    ensure_course_member(db, course, user)
    if not assignment.is_published:
        raise NotFoundError("Assignment not found")
    return assignment


def ensure_assignment_owner(assignment: Assignment, user: User) -> None:
    """Raise 403 unless the user owns the assignment's course."""
    ensure_course_owner(assignment.course, user)


def can_view_submission(submission: Submission, user: User) -> bool:
    """Return True for the submitting student, the course instructor, or an admin."""
    if submission.student_id == user.id:
        return True
    return is_course_owner(submission.assignment.course, user)


def get_submission_for_user(db: Session, submission_id: int, user: User) -> Submission:
    """Load a submission the user may view, or raise 404/403."""
    submission = db.get(Submission, submission_id)
    if submission is None:
        raise NotFoundError("Submission not found")
    if not can_view_submission(submission, user):
        raise ForbiddenError("You cannot view this submission", code="NOT_SUBMISSION_VIEWER")
    return submission


def ensure_submission_instructor(submission: Submission, user: User) -> None:
    """Raise 403 unless the user owns the submission's course."""
    ensure_course_owner(submission.assignment.course, user)


def get_review_or_404(db: Session, review_id: int) -> Review:
    """Load a review by id or raise 404."""
    review = db.get(Review, review_id)
    if review is None:
        raise NotFoundError("Review not found")
    return review


def get_roast_or_404(db: Session, roast_id: int) -> Roast:
    """Load a roast by id or raise 404."""
    roast = db.get(Roast, roast_id)
    if roast is None:
        raise NotFoundError("Roast not found")
    return roast


def roast_course(roast: Roast) -> Course:
    """Return the course a roast belongs to."""
    return roast.review.submission.assignment.course
