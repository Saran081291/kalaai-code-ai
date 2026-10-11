"""Fail submissions stuck mid-pipeline (audit M4).

A crash/restart while a background task runs leaves a submission in ``fetching``,
``reviewing``, ``roasting`` (or never-started ``pending``) forever, and the student can only
retry ``failed`` rows. :func:`sweep_stuck_submissions` marks such stale rows ``failed`` with
the standard retry message so they become retryable. It runs once at application startup.
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import Submission
from app.models.enums import SubmissionStatus

logger = logging.getLogger(__name__)

STALE_AFTER_MINUTES = 10
MSG_STUCK = "Review mudiyala (server restart / timeout) - konjam neram kazhichu retry pannunga."

IN_PROGRESS_STATUSES: frozenset[SubmissionStatus] = frozenset(
    {
        SubmissionStatus.pending,
        SubmissionStatus.fetching,
        SubmissionStatus.reviewing,
        SubmissionStatus.roasting,
    }
)


def stale_cutoff(max_age_minutes: int = STALE_AFTER_MINUTES) -> datetime:
    """Return the UTC instant before which an in-progress row counts as stuck."""
    return datetime.now(UTC) - timedelta(minutes=max_age_minutes)


def sweep_stuck_submissions(db: Session, max_age_minutes: int = STALE_AFTER_MINUTES) -> int:
    """Mark in-progress submissions not updated for ``max_age_minutes`` as ``failed``.

    Returns:
        The number of submissions marked failed.
    """
    result = db.execute(
        update(Submission)
        .where(
            Submission.status.in_(IN_PROGRESS_STATUSES),
            Submission.updated_at < stale_cutoff(max_age_minutes),
        )
        .values(status=SubmissionStatus.failed, error_message=MSG_STUCK)
        .execution_options(synchronize_session=False)
    )
    db.commit()
    count: int = result.rowcount  # type: ignore[attr-defined]
    if count:
        logger.warning("Swept %s stuck submission(s) to failed", count)
    return count


__all__ = [
    "IN_PROGRESS_STATUSES",
    "MSG_STUCK",
    "STALE_AFTER_MINUTES",
    "stale_cutoff",
    "sweep_stuck_submissions",
]
