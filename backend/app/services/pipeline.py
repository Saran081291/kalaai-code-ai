"""Submission processing pipeline (contract §4).

``pending -> fetching -> reviewing -> roasting -> completed``; any error -> ``failed`` with a
user-friendly ``error_message``. Each status transition is committed so the UI can poll it.
Calling :func:`run_pipeline` again resumes at the first incomplete step:

- ``fetching`` is skipped when SubmissionFile rows exist,
- ``reviewing`` is skipped when a Review exists,
- ``roasting`` is skipped when a Roast exists.

Runs as a FastAPI background task with its own session and never raises.
"""

import logging

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.exceptions import ConflictError
from app.models import Submission, SubmissionFile
from app.models.enums import SourceType, SubmissionStatus
from app.services import ai_client
from app.services.review_service import ReviewGenerationError, generate_review
from app.services.roast_service import generate_roast

logger = logging.getLogger(__name__)

MSG_AI_FAILED = "AI review fail aayiduchu, konjam neram kazhichu retry pannunga."
MSG_AI_NOT_CONFIGURED = (
    "AI review service ippo ready illa (not configured) - instructor-kitta sollunga."
)
MSG_ROAST_FAILED = "Roast ready panna mudiyala, konjam neram kazhichu retry pannunga."
MSG_NO_FILES = (
    "Review panna code file onnum kidaikala - supported code files irukkanu check pannunga."
)
MSG_NO_RUBRIC = "Indha assignment-ku rubric illa - instructor-kitta sollunga."
MSG_UNEXPECTED = (
    "Edho thappu nadandhuduchu (unexpected error) - konjam neram kazhichu retry pannunga."
)

_IN_PROGRESS = frozenset(
    {SubmissionStatus.fetching, SubmissionStatus.reviewing, SubmissionStatus.roasting}
)


class PipelineStepError(Exception):
    """A pipeline step failed with a user-facing message."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class FetchStepError(PipelineStepError):
    """Fetching the code failed; the student's attempt is refunded."""


def _set_status(db: Session, submission: Submission, status: SubmissionStatus) -> None:
    submission.status = status
    submission.error_message = None
    db.commit()
    logger.info("Submission %s -> %s", submission.id, status)


def _fetch(db: Session, submission: Submission) -> None:
    """Fetch/collect code and persist SubmissionFile rows (+ commit sha)."""
    from app.services import code_fetcher

    try:
        if submission.source_type == SourceType.github:
            if not submission.github_url:
                raise FetchStepError(MSG_NO_FILES)
            result = code_fetcher.fetch_github_repo(submission.github_url)
        else:
            result = code_fetcher.collect_uploaded_files(
                code_fetcher.submission_upload_dir(submission.id)
            )
    except code_fetcher.CodeFetchError as exc:
        logger.warning("Submission %s fetch failed (%s): %s", submission.id, exc.code, exc.message)
        raise FetchStepError(exc.message) from exc

    if not result.files:
        raise FetchStepError(MSG_NO_FILES)
    for collected in result.files:
        db.add(
            SubmissionFile(
                submission_id=submission.id,
                path=collected.path[:500],
                language=collected.language[:30] if collected.language else None,
                size_bytes=collected.size_bytes,
                content=collected.content,
            )
        )
    if result.commit_sha:
        submission.commit_sha = result.commit_sha[:64]
    db.commit()
    db.refresh(submission)
    logger.info("Submission %s: stored %s file(s)", submission.id, len(result.files))


def _review(db: Session, submission: Submission) -> None:
    try:
        generate_review(db, submission)
    except ReviewGenerationError as exc:
        logger.warning("Submission %s review failed: %s", submission.id, exc.message)
        messages = {"NO_RUBRIC": MSG_NO_RUBRIC, "NO_FILES": MSG_NO_FILES}
        raise PipelineStepError(messages.get(exc.code, MSG_AI_FAILED)) from exc
    db.refresh(submission)


def _roast(db: Session, submission: Submission) -> None:
    review = submission.review
    if review is None:  # pragma: no cover - guarded by caller
        raise PipelineStepError(MSG_AI_FAILED)
    try:
        generate_roast(db, review, submission.spice_level)
    except ai_client.AIConfigError:
        raise
    except ai_client.AIServiceError as exc:
        logger.warning("Submission %s roast failed: %s", submission.id, exc.message)
        raise PipelineStepError(MSG_ROAST_FAILED) from exc
    db.refresh(review)


def _process(db: Session, submission_id: int) -> None:
    submission = db.get(Submission, submission_id)
    if submission is None:
        logger.warning("Pipeline: submission %s not found", submission_id)
        return
    if submission.status == SubmissionStatus.completed:
        logger.info("Pipeline: submission %s already completed", submission_id)
        return

    if not submission.files:
        _set_status(db, submission, SubmissionStatus.fetching)
        _fetch(db, submission)

    if submission.review is None:
        _set_status(db, submission, SubmissionStatus.reviewing)
        _review(db, submission)

    review = submission.review
    if review is not None and review.roast is None:
        _set_status(db, submission, SubmissionStatus.roasting)
        _roast(db, submission)

    _set_status(db, submission, SubmissionStatus.completed)


def _mark_failed(db: Session, submission_id: int, message: str, *, refund: bool = False) -> None:
    try:
        db.rollback()
        submission = db.get(Submission, submission_id)
        if submission is None:
            return
        submission.status = SubmissionStatus.failed
        submission.error_message = message
        if refund:
            submission.attempt_refunded = True
        db.commit()
        logger.info(
            "Submission %s -> failed (%s)%s",
            submission_id,
            message,
            " [refunded]" if refund else "",
        )
    except Exception:
        logger.exception("Pipeline: could not mark submission %s as failed", submission_id)
        db.rollback()


def run_pipeline(submission_id: int) -> None:
    """Process a submission end to end (or resume it). Never raises."""
    try:
        with SessionLocal() as db:
            try:
                _process(db, submission_id)
            except FetchStepError as exc:
                _mark_failed(db, submission_id, exc.message, refund=True)
            except PipelineStepError as exc:
                _mark_failed(db, submission_id, exc.message)
            except ai_client.AIConfigError:
                logger.error("Submission %s: AI client not configured", submission_id)
                _mark_failed(db, submission_id, MSG_AI_NOT_CONFIGURED)
            except ai_client.AIServiceError as exc:
                logger.warning("Submission %s: AI service error: %s", submission_id, exc.message)
                _mark_failed(db, submission_id, MSG_AI_FAILED)
            except Exception:
                logger.exception("Submission %s: unexpected pipeline error", submission_id)
                _mark_failed(db, submission_id, MSG_UNEXPECTED)
    except Exception:
        logger.exception("Pipeline crashed for submission %s", submission_id)


def reset_for_rereview(db: Session, submission: Submission) -> Submission:
    """Delete the review (roast + criterion scores cascade) and set the submission pending.

    Fetched files are kept, so the re-run starts at ``reviewing``.

    Raises:
        ConflictError: ``REVIEW_IN_PROGRESS`` while the pipeline is running.
    """
    if submission.status in _IN_PROGRESS:
        raise ConflictError(
            "Review innum nadandhutu irukku - mudinjadhum try pannunga (review in progress)",
            code="REVIEW_IN_PROGRESS",
        )
    if submission.review is not None:
        db.delete(submission.review)
        db.flush()
    submission.status = SubmissionStatus.pending
    submission.error_message = None
    db.commit()
    db.refresh(submission)
    logger.info("Submission %s reset for re-review", submission.id)
    return submission


__all__ = ["reset_for_rereview", "run_pipeline"]
