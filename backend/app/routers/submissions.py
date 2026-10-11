"""Submission endpoints: submit (GitHub/upload), list, detail, files, retry.

Handlers are plain ``def`` (sync DB + file I/O run in FastAPI's threadpool).
"""

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Request, UploadFile, status

from app.auth.dependencies import CurrentUser, DbSession, StudentUser
from app.dependencies import PaginationParams
from app.models import SpiceLevel
from app.rate_limit import limiter
from app.schemas.base import Page
from app.schemas.submission import SubmissionFileOut, SubmissionOut
from app.services import submission_service

router = APIRouter(tags=["submissions"])

Pagination = Annotated[PaginationParams, Depends()]


@router.post(
    "/assignments/{assignment_id}/submissions",
    response_model=SubmissionOut,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit("10/hour")
def create_submission(
    request: Request,
    assignment_id: int,
    background_tasks: BackgroundTasks,
    user: StudentUser,
    db: DbSession,
    spice_level: Annotated[SpiceLevel, Form(alias="spiceLevel")],
    github_url: Annotated[str | None, Form(alias="githubUrl")] = None,
    files: Annotated[list[UploadFile] | None, File(alias="files")] = None,
) -> SubmissionOut:
    """Submit a GitHub URL XOR code files / one .zip; queues the AI pipeline (202)."""
    submission = submission_service.create_submission(
        db,
        assignment_id=assignment_id,
        user=user,
        spice_level=spice_level,
        github_url=github_url,
        files=files,
    )
    submission_service.queue_pipeline(background_tasks, submission.id)
    return submission_service.get_submission_out(db, submission.id)


@router.get("/assignments/{assignment_id}/submissions", response_model=Page[SubmissionOut])
def list_assignment_submissions(
    assignment_id: int, user: CurrentUser, db: DbSession, pagination: Pagination
) -> Page[SubmissionOut]:
    """Instructor: all students' submissions; student: own attempts. Newest first."""
    return submission_service.list_for_assignment(db, assignment_id, user, pagination)


@router.get("/submissions/me", response_model=Page[SubmissionOut])
def list_my_submissions(
    user: StudentUser, db: DbSession, pagination: Pagination
) -> Page[SubmissionOut]:
    """The current student's submissions across courses, newest first."""
    return submission_service.list_mine(db, user, pagination)


@router.get("/submissions/{submission_id}", response_model=SubmissionOut)
def get_submission(submission_id: int, user: CurrentUser, db: DbSession) -> SubmissionOut:
    """Submission detail + status (polled by the UI)."""
    return submission_service.get_submission(db, submission_id, user)


@router.get("/submissions/{submission_id}/files", response_model=list[SubmissionFileOut])
def list_submission_files(
    submission_id: int, user: CurrentUser, db: DbSession
) -> list[SubmissionFileOut]:
    """Captured source files, ordered by path."""
    return submission_service.list_files(db, submission_id, user)


@router.post(
    "/submissions/{submission_id}/retry",
    response_model=SubmissionOut,
    status_code=status.HTTP_202_ACCEPTED,
)
@limiter.limit("20/hour")
def retry_submission(
    request: Request,
    submission_id: int,
    background_tasks: BackgroundTasks,
    user: CurrentUser,
    db: DbSession,
) -> SubmissionOut:
    """Re-run the pipeline for a failed submission (owner student or course instructor)."""
    submission = submission_service.retry_submission(db, submission_id, user)
    submission_service.queue_pipeline(background_tasks, submission.id)
    return submission_service.get_submission_out(db, submission.id)


__all__ = ["router"]
