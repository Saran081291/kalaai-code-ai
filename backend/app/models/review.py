"""AI code reviews and per-criterion rubric scores."""

from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import JSONType, TimestampMixin

if TYPE_CHECKING:
    from app.models.assignment import RubricCriterion
    from app.models.roast import Roast
    from app.models.submission import Submission


class Review(TimestampMixin, Base):
    """The structured AI review of a submission (one per submission)."""

    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    total_score: Mapped[int] = mapped_column(Integer, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    strengths: Mapped[list[str]] = mapped_column(
        JSONType, nullable=False, default=list, server_default=text("'[]'")
    )
    issues: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONType, nullable=False, default=list, server_default=text("'[]'")
    )
    model_used: Mapped[str] = mapped_column(String(100), nullable=False)
    input_tokens: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    output_tokens: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
    instructor_override_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    instructor_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    submission: Mapped["Submission"] = relationship(back_populates="review")
    criterion_scores: Mapped[list["ReviewCriterionScore"]] = relationship(
        back_populates="review", cascade="all, delete-orphan", passive_deletes=True
    )
    roast: Mapped["Roast | None"] = relationship(
        back_populates="review",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def effective_score(self) -> int:
        """Instructor override if set, otherwise the AI ``total_score``."""
        if self.instructor_override_score is not None:
            return self.instructor_override_score
        return self.total_score

    def __repr__(self) -> str:
        return (
            f"<Review id={self.id} submission_id={self.submission_id} "
            f"effective_score={self.effective_score}>"
        )


class ReviewCriterionScore(Base):
    """Score and feedback for one rubric criterion within a review."""

    __tablename__ = "review_criterion_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(
        ForeignKey("reviews.id", ondelete="CASCADE"), index=True, nullable=False
    )
    criterion_id: Mapped[int] = mapped_column(
        ForeignKey("rubric_criteria.id", ondelete="CASCADE"), index=True, nullable=False
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    feedback: Mapped[str] = mapped_column(Text, nullable=False)

    review: Mapped["Review"] = relationship(back_populates="criterion_scores")
    criterion: Mapped["RubricCriterion"] = relationship(back_populates="criterion_scores")

    def __repr__(self) -> str:
        return (
            f"<ReviewCriterionScore review_id={self.review_id} "
            f"criterion_id={self.criterion_id} score={self.score}>"
        )
