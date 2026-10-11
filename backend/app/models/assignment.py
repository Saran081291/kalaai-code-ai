"""Assignments and their rubric criteria."""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    false,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, str_enum
from app.models.enums import ProgrammingLanguage

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.review import ReviewCriterionScore
    from app.models.submission import Submission
    from app.models.user import User


class Assignment(TimestampMixin, Base):
    """A coding assignment within a course, graded against a rubric."""

    __tablename__ = "assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[ProgrammingLanguage] = mapped_column(
        str_enum(ProgrammingLanguage), nullable=False
    )
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    max_score: Mapped[int] = mapped_column(
        Integer, nullable=False, default=100, server_default=text("100")
    )
    max_attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3, server_default=text("3")
    )
    allow_late: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )

    course: Mapped["Course"] = relationship(back_populates="assignments")
    creator: Mapped["User"] = relationship(foreign_keys=[created_by])
    rubric_criteria: Mapped[list["RubricCriterion"]] = relationship(
        back_populates="assignment",
        order_by="RubricCriterion.position",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    submissions: Mapped[list["Submission"]] = relationship(
        back_populates="assignment", cascade="all, delete-orphan", passive_deletes=True
    )

    def __repr__(self) -> str:
        return f"<Assignment id={self.id} title={self.title!r}>"


class RubricCriterion(Base):
    """A single scored criterion on an assignment's rubric."""

    __tablename__ = "rubric_criteria"
    __table_args__ = (CheckConstraint("max_points > 0", name="max_points_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(
        ForeignKey("assignments.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    max_points: Mapped[int] = mapped_column(Integer, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    assignment: Mapped["Assignment"] = relationship(back_populates="rubric_criteria")
    criterion_scores: Mapped[list["ReviewCriterionScore"]] = relationship(
        back_populates="criterion", cascade="all, delete-orphan", passive_deletes=True
    )

    def __repr__(self) -> str:
        return f"<RubricCriterion id={self.id} name={self.name!r} max_points={self.max_points}>"
