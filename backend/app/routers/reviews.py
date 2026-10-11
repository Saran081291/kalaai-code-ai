"""AI review endpoints: read the review, instructor override, re-review.

Handlers are plain ``def`` (run in the threadpool) because they do sync DB work.
"""

from fastapi import APIRouter, BackgroundTasks, status
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload

from app.auth.dependencies import CurrentUser, DbSession
from app.exceptions import NotFoundError
from app.models import Review, ReviewCriterionScore, Submission
from app.schemas.review import ReviewOut, ReviewOverrideRequest
from app.schemas.submission import SubmissionOut
from app.services import access, review_service
from app.services.pipeline import reset_for_rereview, run_pipeline

router = APIRouter(tags=["reviews"])


def _load_review(db: DbSession, review_id: int) -> Review | None:
    """Load a review with everything ``to_review_out`` needs."""
    stmt = (
        select(Review)
        .where(Review.id == review_id)
        .options(
            selectinload(Review.criterion_scores).joinedload(ReviewCriterionScore.criterion),
            joinedload(Review.submission).joinedload(Submission.assignment),
        )
    )
    return db.scalars(stmt).one_or_none()


@router.get("/submissions/{submission_id}/review", response_model=ReviewOut)
def get_submission_review(submission_id: int, db: DbSession, user: CurrentUser) -> ReviewOut:
    """The submission's review (student owner or course instructor).

    Errors: 403 ``NOT_SUBMISSION_VIEWER``, 404 ``REVIEW_NOT_READY`` until the review exists.
    """
    submission = access.get_submission_for_user(db, submission_id, user)
    review = submission.review
    if review is None:
        raise NotFoundError("Review is not ready yet", code="REVIEW_NOT_READY")
    loaded = _load_review(db, review.id)
    if loaded is None:  # pragma: no cover - deleted concurrently
        raise NotFoundError("Review is not ready yet", code="REVIEW_NOT_READY")
    return review_service.to_review_out(loaded)


@router.put("/reviews/{review_id}/override", response_model=ReviewOut)
def override_review(
    review_id: int, body: ReviewOverrideRequest, db: DbSession, user: CurrentUser
) -> ReviewOut:
    """Course instructor sets (or clears with ``null``) the score override and comment.

    Errors: 400 ``INVALID_OVERRIDE_SCORE`` (above max score), 403 ``NOT_COURSE_OWNER``, 404.
    """
    review = access.get_review_or_404(db, review_id)
    access.ensure_submission_instructor(review.submission, user)
    review_service.apply_override(
        db,
        review,
        body.override_score,
        body.comment,
        update_comment="comment" in body.model_fields_set,
    )
    loaded = _load_review(db, review.id)
    if loaded is None:  # pragma: no cover - deleted concurrently
        raise NotFoundError("Review not found")
    return review_service.to_review_out(loaded)


@router.post(
    "/submissions/{submission_id}/re-review",
    response_model=SubmissionOut,
    status_code=status.HTTP_202_ACCEPTED,
)
def re_review_submission(
    submission_id: int,
    background_tasks: BackgroundTasks,
    db: DbSession,
    user: CurrentUser,
) -> SubmissionOut:
    """Course instructor discards the review + roast and re-runs the AI (202).

    Errors: 403 ``NOT_COURSE_OWNER``, 404, 409 ``REVIEW_IN_PROGRESS``.
    """
    from app.services.submission_service import submission_select, to_submission_out

    submission = access.get_submission_for_user(db, submission_id, user)
    access.ensure_submission_instructor(submission, user)
    reset_for_rereview(db, submission)
    background_tasks.add_task(run_pipeline, submission.id)
    db.expire_all()
    reloaded = db.scalars(submission_select().where(Submission.id == submission.id)).one()
    return to_submission_out(reloaded)
