"""Assignment + rubric endpoints.

Handlers are plain ``def`` so FastAPI runs the synchronous DB work in its threadpool.
"""

from fastapi import APIRouter, Response, status

from app.auth.dependencies import CurrentUser, DbSession, InstructorUser
from app.schemas.assignment import AssignmentCreate, AssignmentOut, AssignmentUpdate, RubricUpdate
from app.services import assignment_service

router = APIRouter(tags=["assignments"])


@router.get("/courses/{course_id}/assignments")
def list_course_assignments(
    course_id: int, db: DbSession, user: CurrentUser
) -> list[AssignmentOut]:
    """Assignments of a course (members). Students only see published ones."""
    return assignment_service.list_for_course(db, course_id, user)


@router.post("/courses/{course_id}/assignments", status_code=status.HTTP_201_CREATED)
def create_assignment(
    course_id: int, body: AssignmentCreate, db: DbSession, user: InstructorUser
) -> AssignmentOut:
    """Create an unpublished assignment with an optional draft rubric (owner)."""
    return assignment_service.create_assignment(db, course_id, user, body)


@router.get("/assignments/{assignment_id}")
def get_assignment(assignment_id: int, db: DbSession, user: CurrentUser) -> AssignmentOut:
    """Assignment detail with rubric; students also get ``myAttemptsCount``."""
    return assignment_service.get_assignment(db, assignment_id, user)


@router.put("/assignments/{assignment_id}")
def update_assignment(
    assignment_id: int, body: AssignmentUpdate, db: DbSession, user: InstructorUser
) -> AssignmentOut:
    """Partially update an assignment (owner)."""
    return assignment_service.update_assignment(db, assignment_id, user, body)


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(assignment_id: int, db: DbSession, user: InstructorUser) -> Response:
    """Delete an assignment without submissions (owner). 409 HAS_SUBMISSIONS otherwise."""
    assignment_service.delete_assignment(db, assignment_id, user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/assignments/{assignment_id}/publish")
def publish_assignment(assignment_id: int, db: DbSession, user: InstructorUser) -> AssignmentOut:
    """Publish (owner). 400 RUBRIC_TOTAL_MISMATCH unless rubric total == maxScore."""
    return assignment_service.publish_assignment(db, assignment_id, user)


@router.put("/assignments/{assignment_id}/rubric")
def replace_rubric(
    assignment_id: int, body: RubricUpdate, db: DbSession, user: InstructorUser
) -> AssignmentOut:
    """Replace all rubric criteria (owner)."""
    return assignment_service.replace_rubric(db, assignment_id, user, body.criteria)
