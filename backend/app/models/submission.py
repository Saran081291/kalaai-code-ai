"""Student submissions and their source files."""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    false,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import str_enum, utcnow
from app.models.enums import SourceType, SpiceLevel, SubmissionStatus

if TYPE_CHECKING:
    from app.models.assignment import Assignment
    from app.models.review import Review
    from app.models.user import User


class Submission(Base):
    """One attempt by a student at an assignment (GitHub repo or file upload)."""

    __tablename__ = "submissions"
    __table_args__ = (
        UniqueConstraint("assignment_id", "student_id", "attempt_number"),
        Index("ix_submissions_assignment_id_student_id", "assignment_id", "student_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(
        ForeignKey("assignments.id", ondelete="CASCADE"), index=True, nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    source_type: Mapped[SourceType] = mapped_column(str_enum(SourceType), nullable=False)
    github_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    commit_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)
    spice_level: Mapped[SpiceLevel] = mapped_column(str_enum(SpiceLevel), nullable=False)
    status: Mapped[SubmissionStatus] = mapped_column(
        str_enum(SubmissionStatus),
        nullable=False,
        index=True,
        default=SubmissionStatus.pending,
        server_default=text("'pending'"),
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_late: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        server_default=func.now(),
        onupdate=utcnow,
    )

    assignment: Mapped["Assignment"] = relationship(back_populates="submissions")
    student: Mapped["User"] = relationship(back_populates="submissions")
    files: Mapped[list["SubmissionFile"]] = relationship(
        back_populates="submission",
        order_by="SubmissionFile.path",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    review: Mapped["Review | None"] = relationship(
        back_populates="submission",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return (
            f"<Submission id={self.id} assignment_id={self.assignment_id} "
            f"student_id={self.student_id} attempt={self.attempt_number} status={self.status}>"
        )


class SubmissionFile(Base):
    """A single source file captured for a submission."""

    __tablename__ = "submission_files"

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    language: Mapped[str | None] = mapped_column(String(30), nullable=True)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )

    submission: Mapped["Submission"] = relationship(back_populates="files")

    def __repr__(self) -> str:
        return f"<SubmissionFile id={self.id} path={self.path!r} size={self.size_bytes}>"
