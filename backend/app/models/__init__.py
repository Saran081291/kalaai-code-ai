"""ORM models package.

Importing this package registers every model on ``Base.metadata`` (used by
Alembic autogenerate and ``Base.metadata.create_all`` in tests).
"""

from app.database import Base
from app.models.assignment import Assignment, RubricCriterion
from app.models.base import SoftDeleteMixin, TimestampMixin
from app.models.course import Course, CourseEnrollment
from app.models.enums import (
    IssueCategory,
    IssueSeverity,
    ProgrammingLanguage,
    ReactionType,
    SourceType,
    SpiceLevel,
    SubmissionStatus,
    UserRole,
)
from app.models.review import Review, ReviewCriterionScore
from app.models.roast import Roast, RoastReaction
from app.models.submission import Submission, SubmissionFile
from app.models.user import RefreshToken, User

__all__ = [
    # Base + mixins
    "Base",
    "SoftDeleteMixin",
    "TimestampMixin",
    # Models
    "Assignment",
    "Course",
    "CourseEnrollment",
    "RefreshToken",
    "Review",
    "ReviewCriterionScore",
    "Roast",
    "RoastReaction",
    "RubricCriterion",
    "Submission",
    "SubmissionFile",
    "User",
    # Enums
    "IssueCategory",
    "IssueSeverity",
    "ProgrammingLanguage",
    "ReactionType",
    "SourceType",
    "SpiceLevel",
    "SubmissionStatus",
    "UserRole",
]
