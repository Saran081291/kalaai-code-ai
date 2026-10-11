"""Review schemas: API responses/requests and the AI review output contract."""

from datetime import datetime

from pydantic import Field

from app.models.enums import IssueCategory, IssueSeverity
from app.schemas.base import CamelModel

MAX_OVERRIDE_COMMENT_LENGTH = 2000


class ReviewIssueOut(CamelModel):
    """One issue found in the code (``ReviewIssue`` on the frontend)."""

    file: str
    line: int | None = None
    severity: IssueSeverity
    category: IssueCategory
    message: str
    suggestion: str


class ReviewCriterionScoreOut(CamelModel):
    """Score for one rubric criterion, with the criterion's name and max points joined in."""

    id: int
    review_id: int
    criterion_id: int
    score: int
    feedback: str
    criterion_name: str | None = None
    max_points: int | None = None


class ReviewOut(CamelModel):
    """Full review returned by ``GET /submissions/{id}/review``."""

    id: int
    submission_id: int
    total_score: int
    summary: str
    strengths: list[str]
    issues: list[ReviewIssueOut]
    criterion_scores: list[ReviewCriterionScoreOut]
    model_used: str
    input_tokens: int
    output_tokens: int
    instructor_override_score: int | None = None
    instructor_comment: str | None = None
    effective_score: int
    max_score: int | None = None
    created_at: datetime
    updated_at: datetime


class ReviewOverrideRequest(CamelModel):
    """Body of ``PUT /reviews/{id}/override``. ``overrideScore: null`` clears the override."""

    override_score: int | None = Field(..., ge=0)
    comment: str | None = Field(default=None, max_length=MAX_OVERRIDE_COMMENT_LENGTH)


# ---------------------------------------------------------------------------
# AI output contract (validated server-side; never trusted blindly)
# ---------------------------------------------------------------------------


class AIReviewCriterion(CamelModel):
    """A criterion score as proposed by the model (clamped server-side)."""

    criterion_id: int
    score: float
    feedback: str


class AIReviewIssue(CamelModel):
    """An issue as reported by the model."""

    file: str
    line: int | None = None
    severity: IssueSeverity
    category: IssueCategory
    message: str = Field(min_length=1)
    suggestion: str


class AIReviewOutput(CamelModel):
    """The structured JSON the review model must return."""

    summary: str = Field(min_length=1)
    strengths: list[str] = Field(default_factory=list)
    criteria: list[AIReviewCriterion]
    issues: list[AIReviewIssue] = Field(default_factory=list)


__all__ = [
    "AIReviewCriterion",
    "AIReviewIssue",
    "AIReviewOutput",
    "MAX_OVERRIDE_COMMENT_LENGTH",
    "ReviewCriterionScoreOut",
    "ReviewIssueOut",
    "ReviewOut",
    "ReviewOverrideRequest",
]
