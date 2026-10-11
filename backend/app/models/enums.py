"""String enums shared by the ORM models, Pydantic schemas and the frontend."""

from enum import StrEnum


class UserRole(StrEnum):
    """Role of a platform user."""

    student = "student"
    instructor = "instructor"
    admin = "admin"


class ProgrammingLanguage(StrEnum):
    """Primary language an assignment is written in."""

    python = "python"
    javascript = "javascript"
    typescript = "typescript"
    java = "java"
    c = "c"
    cpp = "cpp"
    other = "other"


class SourceType(StrEnum):
    """Where a submission's code came from."""

    github = "github"
    upload = "upload"


class SpiceLevel(StrEnum):
    """How harsh the Madurai roast should be."""

    mild = "mild"
    medium = "medium"
    mass = "mass"


class SubmissionStatus(StrEnum):
    """Processing pipeline state of a submission."""

    pending = "pending"
    fetching = "fetching"
    reviewing = "reviewing"
    roasting = "roasting"
    completed = "completed"
    failed = "failed"


class IssueSeverity(StrEnum):
    """Severity of a review issue (stored inside Review.issues JSON)."""

    critical = "critical"
    major = "major"
    minor = "minor"
    nit = "nit"


class IssueCategory(StrEnum):
    """Category of a review issue (stored inside Review.issues JSON)."""

    bug = "bug"
    security = "security"
    quality = "quality"
    performance = "performance"
    style = "style"
    testing = "testing"


class ReactionType(StrEnum):
    """Emoji-style reaction a user can leave on a roast."""

    fire = "fire"
    laugh = "laugh"
    skull = "skull"
    clap = "clap"


__all__ = [
    "IssueCategory",
    "IssueSeverity",
    "ProgrammingLanguage",
    "ReactionType",
    "SourceType",
    "SpiceLevel",
    "SubmissionStatus",
    "UserRole",
]
