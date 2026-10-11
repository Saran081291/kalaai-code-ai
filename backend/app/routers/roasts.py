"""Madurai roast endpoints: read, regenerate (owner student), hide/unhide (instructor).

Handlers are plain ``def`` (run in the threadpool): regenerate makes a blocking AI call.
"""

import logging

from fastapi import APIRouter, Request

from app.auth.dependencies import CurrentUser, DbSession
from app.exceptions import AppError, ForbiddenError, NotFoundError
from app.rate_limit import limiter
from app.schemas.roast import RoastOut, RoastRegenerateRequest, RoastVisibilityRequest
from app.services import access, ai_client, roast_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["roasts"])


class AIUnavailableError(AppError):
    """503 - the AI service could not produce a roast right now."""

    status_code = 503
    code = "AI_UNAVAILABLE"
    default_detail = "AI roast ippo ready aagala, konjam neram kazhichu try pannunga."


def _not_ready() -> NotFoundError:
    return NotFoundError("Roast is not ready yet", code="ROAST_NOT_READY")


@router.get("/submissions/{submission_id}/roast", response_model=RoastOut)
def get_submission_roast(submission_id: int, db: DbSession, user: CurrentUser) -> RoastOut:
    """The submission's roast. Hidden roasts are visible only to the course instructor.

    Errors: 403 ``NOT_SUBMISSION_VIEWER``, 404 ``ROAST_NOT_READY`` (also for hidden roasts
    viewed by the student, so hiding is not revealed).
    """
    submission = access.get_submission_for_user(db, submission_id, user)
    review = submission.review
    roast = review.roast if review is not None else None
    if roast is None:
        raise _not_ready()
    if roast.is_hidden and not access.is_course_owner(submission.assignment.course, user):
        raise _not_ready()
    return RoastOut.model_validate(roast)


@router.post("/roasts/{roast_id}/regenerate", response_model=RoastOut)
@limiter.limit("5/hour")
def regenerate_roast(
    request: Request,
    roast_id: int,
    db: DbSession,
    user: CurrentUser,
    body: RoastRegenerateRequest | None = None,
) -> RoastOut:
    """Owner student regenerates the roast, optionally with a new ``spiceLevel`` (max 2).

    Errors: 403 ``NOT_ROAST_OWNER``, 404 (missing or hidden), 409 ``REGENERATE_LIMIT``,
    429 rate limit, 503 ``AI_UNAVAILABLE``.
    """
    roast = access.get_roast_or_404(db, roast_id)
    submission = roast.review.submission
    if submission.student_id != user.id:
        raise ForbiddenError(
            "Only the student who submitted can regenerate", code="NOT_ROAST_OWNER"
        )
    if roast.is_hidden:
        raise _not_ready()
    spice_level = body.spice_level if body is not None else None
    try:
        updated = roast_service.regenerate_roast(db, roast, spice_level)
    except ai_client.AIError as exc:
        db.rollback()
        logger.warning("Roast %s regenerate failed: %s", roast_id, exc.message)
        raise AIUnavailableError() from exc
    return RoastOut.model_validate(updated)


@router.put("/roasts/{roast_id}/visibility", response_model=RoastOut)
def set_roast_visibility(
    roast_id: int, body: RoastVisibilityRequest, db: DbSession, user: CurrentUser
) -> RoastOut:
    """Course instructor hides/unhides a roast (hidden roasts leave the wall).

    Errors: 403 ``NOT_COURSE_OWNER``, 404.
    """
    roast = access.get_roast_or_404(db, roast_id)
    access.ensure_course_owner(access.roast_course(roast), user)
    roast.is_hidden = body.is_hidden
    db.commit()
    db.refresh(roast)
    logger.info("Roast %s visibility set: hidden=%s by user %s", roast.id, roast.is_hidden, user.id)
    return RoastOut.model_validate(roast)
