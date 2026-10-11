"""Course endpoints: CRUD (archive), join by code, regenerate code, roster.

Handlers are plain ``def`` so FastAPI runs the synchronous DB work in its threadpool.
"""

from fastapi import APIRouter, Response, status

from app.auth.dependencies import CurrentUser, DbSession, InstructorUser, StudentUser
from app.schemas.course import CourseCreate, CourseJoin, CourseOut, CourseStudent, CourseUpdate
from app.services import course_service

router = APIRouter(tags=["courses"])


@router.post("/courses", status_code=status.HTTP_201_CREATED)
def create_course(body: CourseCreate, db: DbSession, user: InstructorUser) -> CourseOut:
    """Create a course (instructor). A unique 8-character join code is generated."""
    return course_service.create_course(db, user, body)


@router.get("/courses")
def list_courses(db: DbSession, user: CurrentUser) -> list[CourseOut]:
    """Non-archived courses the user teaches or is enrolled in (admins: all), newest first."""
    return course_service.list_courses(db, user)


@router.post("/courses/join")
def join_course(body: CourseJoin, db: DbSession, user: StudentUser) -> CourseOut:
    """Join a course by code (student). 404 INVALID_JOIN_CODE, 409 ALREADY_ENROLLED."""
    return course_service.join_course(db, user, body.join_code)


@router.get("/courses/{course_id}")
def get_course(course_id: int, db: DbSession, user: CurrentUser) -> CourseOut:
    """Course detail (owner, enrolled student or admin)."""
    return course_service.get_course(db, course_id, user)


@router.put("/courses/{course_id}")
def update_course(
    course_id: int, body: CourseUpdate, db: DbSession, user: InstructorUser
) -> CourseOut:
    """Update name / description (owner)."""
    return course_service.update_course(db, course_id, user, body)


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_course(course_id: int, db: DbSession, user: InstructorUser) -> Response:
    """Archive the course (owner). Returns 204."""
    course_service.archive_course(db, course_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/courses/{course_id}/regenerate-code")
def regenerate_code(course_id: int, db: DbSession, user: InstructorUser) -> CourseOut:
    """Issue a new join code (owner); the old code stops working."""
    return course_service.regenerate_join_code(db, course_id, user)


@router.get("/courses/{course_id}/students")
def list_students(course_id: int, db: DbSession, user: InstructorUser) -> list[CourseStudent]:
    """Enrolled students ordered by name (owner)."""
    return course_service.list_students(db, course_id, user)
