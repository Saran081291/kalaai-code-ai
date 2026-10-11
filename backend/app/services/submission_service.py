"""Submission business logic: create (GitHub or upload), list, detail, files, retry."""

import logging
import re
import shutil
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath

from fastapi import BackgroundTasks, UploadFile
from sqlalchemy import Select, and_, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.config import settings
from app.dependencies import PaginationParams
from app.exceptions import BadRequestError, ConflictError, PayloadTooLargeError
from app.models import (
    Assignment,
    Course,
    SourceType,
    SpiceLevel,
    Submission,
    SubmissionFile,
    SubmissionStatus,
    User,
)
from app.schemas.base import Page
from app.schemas.submission import SubmissionFileOut, SubmissionOut
from app.services import access
from app.services.code_fetcher import (
    ALLOWED_EXTENSIONS,
    ZIP_EXTENSION,
    CodeFetchError,
    collect_uploaded_files,
    submission_upload_dir,
    validate_github_url,
)
from app.services.pipeline_sweeper import IN_PROGRESS_STATUSES, stale_cutoff

logger = logging.getLogger(__name__)

_READ_CHUNK = 64 * 1024
_MAX_FILENAME_LENGTH = 255
_UNSAFE_FILENAME_CHARS = re.compile(r"[^A-Za-z0-9._ -]")
_WINDOWS_RESERVED = frozenset(
    {"con", "prn", "aux", "nul"}
    | {f"com{i}" for i in range(1, 10)}
    | {f"lpt{i}" for i in range(1, 10)}
)
_ZIP_MAGIC = (b"PK\x03\x04", b"PK\x05\x06")


@dataclass(frozen=True)
class UploadedBlob:
    """An uploaded file read fully into memory under a sanitised name."""

    filename: str
    data: bytes


# --- Serialisation -----------------------------------------------------------


def submission_select() -> Select[Submission]:
    """``select(Submission)`` eager-loading everything ``to_submission_out`` needs."""
    return select(Submission).options(
        joinedload(Submission.assignment).joinedload(Assignment.course),
        joinedload(Submission.student),
        selectinload(Submission.review),
    )


def to_submission_out(submission: Submission) -> SubmissionOut:
    """Build the denormalised API shape.

    Expects ``assignment.course``, ``student`` and ``review`` loaded (see
    :func:`submission_select`); otherwise they are lazy-loaded from the session.
    """
    assignment = submission.assignment
    review = submission.review
    student = submission.student
    return SubmissionOut(
        id=submission.id,
        assignment_id=submission.assignment_id,
        student_id=submission.student_id,
        attempt_number=submission.attempt_number,
        source_type=submission.source_type,
        github_url=submission.github_url,
        commit_sha=submission.commit_sha,
        spice_level=submission.spice_level,
        status=submission.status,
        error_message=submission.error_message,
        is_late=submission.is_late,
        submitted_at=submission.submitted_at,
        created_at=submission.submitted_at,
        updated_at=submission.updated_at,
        student_name=student.full_name if student is not None else None,
        assignment_title=assignment.title,
        course_id=assignment.course_id,
        course_name=assignment.course.name,
        effective_score=review.effective_score if review is not None else None,
        max_score=assignment.max_score,
    )


def _load_out(db: Session, submission_id: int) -> SubmissionOut:
    submission = db.scalars(submission_select().where(Submission.id == submission_id)).one()
    return to_submission_out(submission)


def _page(
    db: Session, stmt: Select[Submission], pagination: PaginationParams
) -> Page[SubmissionOut]:
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(
        stmt.order_by(Submission.submitted_at.desc(), Submission.id.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    ).all()
    return Page[SubmissionOut](
        items=[to_submission_out(row) for row in rows],
        total=total,
        page=pagination.page,
        page_size=pagination.page_size,
    )


# --- Upload handling ---------------------------------------------------------


def sanitize_filename(raw: str | None) -> str:
    """Reduce a client-supplied filename to a safe basename ('' if nothing usable)."""
    if not raw:
        return ""
    base = raw.replace("\\", "/").rsplit("/", 1)[-1].strip()
    base = _UNSAFE_FILENAME_CHARS.sub("_", base).strip(" ")
    if base in ("", ".", "..") or set(base) == {"."}:
        return ""
    stem = PurePosixPath(base).stem.lower()
    if stem in _WINDOWS_RESERVED:
        base = f"_{base}"
    if len(base) > _MAX_FILENAME_LENGTH:
        suffix = PurePosixPath(base).suffix[:16]
        base = base[: _MAX_FILENAME_LENGTH - len(suffix)] + suffix
    return base


def _max_upload_bytes() -> int:
    return settings.MAX_UPLOAD_MB * 1024 * 1024


def read_uploads(uploads: Sequence[UploadFile]) -> list[UploadedBlob]:
    """Validate names/types/counts and read uploads in chunks under the size cap.

    Raises:
        PayloadTooLargeError: ``TOO_MANY_FILES`` / ``UPLOAD_TOO_LARGE`` (413).
        BadRequestError: unsupported type, bad zip combination, duplicate or empty names.
    """
    real = [u for u in uploads if u.filename]
    if not real:
        raise BadRequestError("Provide either githubUrl or files", code="BAD_REQUEST")
    if len(real) > settings.MAX_UPLOAD_FILES:
        raise PayloadTooLargeError(
            f"Too many files (max {settings.MAX_UPLOAD_FILES})", code="TOO_MANY_FILES"
        )

    names: list[str] = []
    for upload in real:
        name = sanitize_filename(upload.filename)
        if not name:
            raise BadRequestError("Invalid file name", code="UNSUPPORTED_FILE")
        suffix = PurePosixPath(name).suffix.lower()
        if suffix != ZIP_EXTENSION and suffix not in ALLOWED_EXTENSIONS:
            raise BadRequestError(f"Unsupported file type: {name}", code="UNSUPPORTED_FILE")
        if name.lower() in (n.lower() for n in names):
            raise BadRequestError(f"Duplicate file name: {name}", code="DUPLICATE_FILE")
        names.append(name)

    zip_count = sum(1 for n in names if n.lower().endswith(ZIP_EXTENSION))
    if zip_count > 1 or (zip_count == 1 and len(names) > 1):
        raise BadRequestError(
            "Upload either code files or a single .zip (not both, not multiple zips)",
            code="BAD_REQUEST",
        )

    cap = _max_upload_bytes()
    total = 0
    blobs: list[UploadedBlob] = []
    for upload, name in zip(real, names, strict=True):
        buffer = bytearray()
        upload.file.seek(0)
        while chunk := upload.file.read(_READ_CHUNK):
            total += len(chunk)
            if total > cap:
                raise PayloadTooLargeError(
                    f"Upload too large (max {settings.MAX_UPLOAD_MB} MB)",
                    code="UPLOAD_TOO_LARGE",
                )
            buffer.extend(chunk)
        data = bytes(buffer)
        if name.lower().endswith(ZIP_EXTENSION) and not data.startswith(_ZIP_MAGIC):
            raise BadRequestError(f"{name} is not a valid zip file", code="UNSUPPORTED_FILE")
        blobs.append(UploadedBlob(filename=name, data=data))
    return blobs


def _save_uploads(directory: Path, blobs: list[UploadedBlob]) -> None:
    """Write blobs into a fresh submission upload directory."""
    if directory.exists():
        shutil.rmtree(directory)
    directory.mkdir(parents=True)
    root = directory.resolve()
    for blob in blobs:
        target = (directory / blob.filename).resolve()
        if target.parent != root:
            raise BadRequestError("Invalid file name", code="UNSUPPORTED_FILE")
        with target.open("xb") as handle:
            handle.write(blob.data)


# --- Create ------------------------------------------------------------------


def _ensure_can_submit(db: Session, assignment: Assignment, user: User) -> tuple[int, bool]:
    """Apply course/publish/attempt/due-date rules. Returns ``(attempt_number, is_late)``."""
    course: Course = assignment.course
    if course.is_archived:
        raise ConflictError("This course is archived", code="COURSE_ARCHIVED")
    if not assignment.is_published:
        raise ConflictError("Assignment is not published", code="NOT_PUBLISHED")

    used, last = db.execute(
        select(
            func.count(Submission.id).filter(Submission.attempt_refunded.is_(False)),
            func.max(Submission.attempt_number),
        ).where(Submission.assignment_id == assignment.id, Submission.student_id == user.id)
    ).one()
    if used >= assignment.max_attempts:
        raise ConflictError(
            f"Attempt limit reached ({assignment.max_attempts})", code="ATTEMPT_LIMIT"
        )

    is_late = False
    if assignment.due_date is not None:
        due = assignment.due_date
        if due.tzinfo is None:
            due = due.replace(tzinfo=UTC)
        if datetime.now(UTC) > due:
            if not assignment.allow_late:
                raise ConflictError("The due date has passed", code="PAST_DUE")
            is_late = True
    return (last or 0) + 1, is_late


def create_submission(
    db: Session,
    *,
    assignment_id: int,
    user: User,
    spice_level: SpiceLevel,
    github_url: str | None,
    files: Sequence[UploadFile] | None,
) -> Submission:
    """Validate and persist a new attempt (uploads saved to disk). Caller queues the pipeline."""
    assignment = access.get_assignment_for_user(db, assignment_id, user)
    attempt_number, is_late = _ensure_can_submit(db, assignment, user)

    url = (github_url or "").strip() or None
    uploads = [f for f in (files or []) if f.filename]
    if (url is None) == (not uploads):
        raise BadRequestError("Provide either githubUrl or files (exactly one)")

    normalised_url: str | None = None
    blobs: list[UploadedBlob] = []
    if url is not None:
        normalised_url = validate_github_url(url)
    else:
        blobs = read_uploads(uploads)

    submission = Submission(
        assignment_id=assignment.id,
        student_id=user.id,
        attempt_number=attempt_number,
        source_type=SourceType.github if normalised_url else SourceType.upload,
        github_url=normalised_url,
        spice_level=spice_level,
        status=SubmissionStatus.pending,
        is_late=is_late,
    )
    db.add(submission)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(
            "Another submission was just created - please try again", code="ATTEMPT_CONFLICT"
        ) from exc

    upload_dir: Path | None = None
    try:
        if blobs:
            upload_dir = submission_upload_dir(submission.id)
            _save_uploads(upload_dir, blobs)
            # Fail fast (without burning an attempt) on unsafe zips / no code files.
            collect_uploaded_files(upload_dir)
        db.commit()
    except CodeFetchError as exc:
        _discard(db, upload_dir)
        raise BadRequestError(exc.message, code=exc.code) from exc
    except IntegrityError as exc:
        _discard(db, upload_dir)
        raise ConflictError(
            "Another submission was just created - please try again", code="ATTEMPT_CONFLICT"
        ) from exc
    except Exception:
        _discard(db, upload_dir)
        raise

    logger.info(
        "Submission %s created (assignment=%s student=%s attempt=%s source=%s late=%s)",
        submission.id,
        assignment.id,
        user.id,
        attempt_number,
        submission.source_type,
        is_late,
    )
    return submission


def _discard(db: Session, upload_dir: Path | None) -> None:
    db.rollback()
    if upload_dir is not None and upload_dir.exists():
        shutil.rmtree(upload_dir, ignore_errors=True)


def queue_pipeline(background_tasks: BackgroundTasks, submission_id: int) -> None:
    """Schedule the AI pipeline (imported lazily; owned by the review module)."""
    from app.services.pipeline import run_pipeline

    background_tasks.add_task(run_pipeline, submission_id)


def get_submission_out(db: Session, submission_id: int) -> SubmissionOut:
    """Serialise a submission by id with relationships eager-loaded."""
    return _load_out(db, submission_id)


# --- Read --------------------------------------------------------------------


def list_for_assignment(
    db: Session, assignment_id: int, user: User, pagination: PaginationParams
) -> Page[SubmissionOut]:
    """Course owner: every student's submissions; student: own attempts. Newest first."""
    assignment = access.get_assignment_for_user(db, assignment_id, user)
    stmt = submission_select().where(Submission.assignment_id == assignment.id)
    if not access.is_course_owner(assignment.course, user):
        stmt = stmt.where(Submission.student_id == user.id)
    return _page(db, stmt, pagination)


def list_mine(db: Session, user: User, pagination: PaginationParams) -> Page[SubmissionOut]:
    """The current student's submissions across all courses, newest first."""
    return _page(db, submission_select().where(Submission.student_id == user.id), pagination)


def get_submission(db: Session, submission_id: int, user: User) -> SubmissionOut:
    """Detail for the submitting student, course instructor or admin."""
    submission = access.get_submission_for_user(db, submission_id, user)
    return to_submission_out(submission)


def list_files(db: Session, submission_id: int, user: User) -> list[SubmissionFileOut]:
    """Captured source files ordered by path."""
    submission = access.get_submission_for_user(db, submission_id, user)
    rows = db.scalars(
        select(SubmissionFile)
        .where(SubmissionFile.submission_id == submission.id)
        .order_by(SubmissionFile.path)
    ).all()
    return [SubmissionFileOut.model_validate(row) for row in rows]


def retry_submission(db: Session, submission_id: int, user: User) -> Submission:
    """Reset a failed (or stuck, M4) submission to ``pending``. Caller queues the pipeline.

    Rows still in progress are retryable only once stale (no update for the sweep cutoff).
    """
    submission = access.get_submission_for_user(db, submission_id, user)
    if submission.attempt_refunded:
        # Retrying takes the refunded attempt back; refuse if no attempt is left for it.
        used = db.scalar(
            select(func.count(Submission.id)).where(
                Submission.assignment_id == submission.assignment_id,
                Submission.student_id == submission.student_id,
                Submission.attempt_refunded.is_(False),
            )
        )
        if (used or 0) >= submission.assignment.max_attempts:
            raise ConflictError(
                f"Attempt limit reached ({submission.assignment.max_attempts})",
                code="ATTEMPT_LIMIT",
            )
    # Conditional UPDATE so two concurrent retries cannot both queue the pipeline.
    result = db.execute(
        update(Submission)
        .where(
            Submission.id == submission.id,
            or_(
                Submission.status == SubmissionStatus.failed,
                and_(
                    Submission.status.in_(IN_PROGRESS_STATUSES),
                    Submission.updated_at < stale_cutoff(),
                ),
            ),
        )
        .values(status=SubmissionStatus.pending, error_message=None, attempt_refunded=False)
        .execution_options(synchronize_session=False)
    )
    if result.rowcount == 0:  # type: ignore[attr-defined]
        db.rollback()
        raise ConflictError("Only failed or stuck submissions can be retried", code="NOT_RETRYABLE")
    db.commit()
    db.refresh(submission)
    logger.info("Submission %s queued for retry by user %s", submission.id, user.id)
    return submission


__all__ = [
    "UploadedBlob",
    "create_submission",
    "get_submission",
    "get_submission_out",
    "list_files",
    "list_for_assignment",
    "list_mine",
    "queue_pipeline",
    "read_uploads",
    "retry_submission",
    "sanitize_filename",
    "submission_select",
    "to_submission_out",
]
