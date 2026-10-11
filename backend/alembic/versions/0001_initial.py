"""Initial schema: users, courses, assignments, submissions, reviews, roasts.

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-10 00:00:00

Hand-written to mirror ``app.models`` exactly. Enum columns are non-native
(VARCHAR(20), no CHECK constraint) so the schema is portable to SQLite; JSON
columns are JSONB on PostgreSQL and JSON elsewhere.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _enum(name: str, *values: str) -> sa.Enum:
    """Non-native string enum matching ``app.models.base.str_enum``."""
    return sa.Enum(*values, name=name, native_enum=False, length=20)


def _json() -> sa.types.TypeEngine[object]:
    """JSON column type matching ``app.models.base.JSONType``."""
    return sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def _ts(name: str, *, nullable: bool = False, server_default: bool = True) -> sa.Column:
    """Timezone-aware timestamp column (``now()`` server default by default)."""
    return sa.Column(
        name,
        sa.DateTime(timezone=True),
        nullable=nullable,
        server_default=sa.func.now() if server_default else None,
    )


USER_ROLE = ("student", "instructor", "admin")
SPICE_LEVEL = ("mild", "medium", "mass")
PROGRAMMING_LANGUAGE = ("python", "javascript", "typescript", "java", "c", "cpp", "other")
SOURCE_TYPE = ("github", "upload")
SUBMISSION_STATUS = ("pending", "fetching", "reviewing", "roasting", "completed", "failed")
REACTION_TYPE = ("fire", "laugh", "skull", "clap")


def upgrade() -> None:
    """Create all 12 tables with their constraints and indexes."""
    # --- users -------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=True),
        sa.Column("full_name", sa.String(length=100), nullable=False),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column(
            "role",
            _enum("userrole", *USER_ROLE),
            nullable=False,
            server_default=sa.text("'student'"),
        ),
        sa.Column(
            "default_spice_level",
            _enum("spicelevel", *SPICE_LEVEL),
            nullable=False,
            server_default=sa.text("'medium'"),
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("oauth_provider", sa.String(length=20), nullable=True),
        _ts("created_at"),
        _ts("updated_at"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    # --- refresh_tokens ----------------------------------------------------
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        _ts("expires_at", server_default=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
        _ts("created_at"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_refresh_tokens_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_refresh_tokens")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_refresh_tokens_token_hash")),
    )
    op.create_index(op.f("ix_refresh_tokens_user_id"), "refresh_tokens", ["user_id"], unique=False)

    # --- courses -----------------------------------------------------------
    op.create_table(
        "courses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("instructor_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("join_code", sa.String(length=8), nullable=False),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        _ts("created_at"),
        _ts("updated_at"),
        sa.ForeignKeyConstraint(
            ["instructor_id"], ["users.id"], name=op.f("fk_courses_instructor_id_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_courses")),
    )
    op.create_index(op.f("ix_courses_instructor_id"), "courses", ["instructor_id"], unique=False)
    op.create_index(op.f("ix_courses_join_code"), "courses", ["join_code"], unique=True)

    # --- course_enrollments ------------------------------------------------
    op.create_table(
        "course_enrollments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        _ts("joined_at"),
        sa.UniqueConstraint(
            "course_id",
            "student_id",
            name=op.f("uq_course_enrollments_course_id_student_id"),
        ),
        sa.ForeignKeyConstraint(
            ["course_id"],
            ["courses.id"],
            name=op.f("fk_course_enrollments_course_id_courses"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["users.id"],
            name=op.f("fk_course_enrollments_student_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_course_enrollments")),
    )
    op.create_index(
        op.f("ix_course_enrollments_course_id"), "course_enrollments", ["course_id"], unique=False
    )
    op.create_index(
        op.f("ix_course_enrollments_student_id"),
        "course_enrollments",
        ["student_id"],
        unique=False,
    )

    # --- assignments -------------------------------------------------------
    op.create_table(
        "assignments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("language", _enum("programminglanguage", *PROGRAMMING_LANGUAGE), nullable=False),
        _ts("due_date", nullable=True, server_default=False),
        sa.Column("max_score", sa.Integer(), nullable=False, server_default=sa.text("100")),
        sa.Column("max_attempts", sa.Integer(), nullable=False, server_default=sa.text("3")),
        sa.Column("allow_late", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.false()),
        _ts("created_at"),
        _ts("updated_at"),
        sa.ForeignKeyConstraint(
            ["course_id"],
            ["courses.id"],
            name=op.f("fk_assignments_course_id_courses"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"], ["users.id"], name=op.f("fk_assignments_created_by_users")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_assignments")),
    )
    op.create_index(op.f("ix_assignments_course_id"), "assignments", ["course_id"], unique=False)
    op.create_index(op.f("ix_assignments_created_by"), "assignments", ["created_by"], unique=False)

    # --- rubric_criteria ---------------------------------------------------
    op.create_table(
        "rubric_criteria",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("max_points", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.CheckConstraint("max_points > 0", name=op.f("ck_rubric_criteria_max_points_positive")),
        sa.ForeignKeyConstraint(
            ["assignment_id"],
            ["assignments.id"],
            name=op.f("fk_rubric_criteria_assignment_id_assignments"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_rubric_criteria")),
    )
    op.create_index(
        op.f("ix_rubric_criteria_assignment_id"),
        "rubric_criteria",
        ["assignment_id"],
        unique=False,
    )

    # --- submissions -------------------------------------------------------
    op.create_table(
        "submissions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=False),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("source_type", _enum("sourcetype", *SOURCE_TYPE), nullable=False),
        sa.Column("github_url", sa.String(length=500), nullable=True),
        sa.Column("commit_sha", sa.String(length=64), nullable=True),
        sa.Column("spice_level", _enum("spicelevel", *SPICE_LEVEL), nullable=False),
        sa.Column(
            "status",
            _enum("submissionstatus", *SUBMISSION_STATUS),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("is_late", sa.Boolean(), nullable=False, server_default=sa.false()),
        _ts("submitted_at"),
        _ts("updated_at"),
        sa.UniqueConstraint(
            "assignment_id",
            "student_id",
            "attempt_number",
            name=op.f("uq_submissions_assignment_id_student_id_attempt_number"),
        ),
        sa.ForeignKeyConstraint(
            ["assignment_id"],
            ["assignments.id"],
            name=op.f("fk_submissions_assignment_id_assignments"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["users.id"],
            name=op.f("fk_submissions_student_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_submissions")),
    )
    op.create_index(
        op.f("ix_submissions_assignment_id"), "submissions", ["assignment_id"], unique=False
    )
    op.create_index(op.f("ix_submissions_student_id"), "submissions", ["student_id"], unique=False)
    op.create_index(op.f("ix_submissions_status"), "submissions", ["status"], unique=False)
    op.create_index(
        "ix_submissions_assignment_id_student_id",
        "submissions",
        ["assignment_id", "student_id"],
        unique=False,
    )

    # --- submission_files --------------------------------------------------
    op.create_table(
        "submission_files",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("submission_id", sa.Integer(), nullable=False),
        sa.Column("path", sa.String(length=500), nullable=False),
        sa.Column("language", sa.String(length=30), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        _ts("created_at"),
        sa.ForeignKeyConstraint(
            ["submission_id"],
            ["submissions.id"],
            name=op.f("fk_submission_files_submission_id_submissions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_submission_files")),
    )
    op.create_index(
        op.f("ix_submission_files_submission_id"),
        "submission_files",
        ["submission_id"],
        unique=False,
    )

    # --- reviews -----------------------------------------------------------
    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("submission_id", sa.Integer(), nullable=False),
        sa.Column("total_score", sa.Integer(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("strengths", _json(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("issues", _json(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("model_used", sa.String(length=100), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("instructor_override_score", sa.Integer(), nullable=True),
        sa.Column("instructor_comment", sa.Text(), nullable=True),
        _ts("created_at"),
        _ts("updated_at"),
        sa.ForeignKeyConstraint(
            ["submission_id"],
            ["submissions.id"],
            name=op.f("fk_reviews_submission_id_submissions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_reviews")),
    )
    op.create_index(op.f("ix_reviews_submission_id"), "reviews", ["submission_id"], unique=True)

    # --- review_criterion_scores -------------------------------------------
    op.create_table(
        "review_criterion_scores",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("review_id", sa.Integer(), nullable=False),
        sa.Column("criterion_id", sa.Integer(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("feedback", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["review_id"],
            ["reviews.id"],
            name=op.f("fk_review_criterion_scores_review_id_reviews"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["criterion_id"],
            ["rubric_criteria.id"],
            name=op.f("fk_review_criterion_scores_criterion_id_rubric_criteria"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_review_criterion_scores")),
    )
    op.create_index(
        op.f("ix_review_criterion_scores_review_id"),
        "review_criterion_scores",
        ["review_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_review_criterion_scores_criterion_id"),
        "review_criterion_scores",
        ["criterion_id"],
        unique=False,
    )

    # --- roasts ------------------------------------------------------------
    op.create_table(
        "roasts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("review_id", sa.Integer(), nullable=False),
        sa.Column("spice_level", _enum("spicelevel", *SPICE_LEVEL), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("punchline", sa.String(length=140), nullable=False),
        sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_shared", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("share_slug", sa.String(length=16), nullable=True),
        sa.Column("regenerate_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        _ts("created_at"),
        _ts("updated_at"),
        sa.ForeignKeyConstraint(
            ["review_id"],
            ["reviews.id"],
            name=op.f("fk_roasts_review_id_reviews"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roasts")),
    )
    op.create_index(op.f("ix_roasts_review_id"), "roasts", ["review_id"], unique=True)
    op.create_index(op.f("ix_roasts_share_slug"), "roasts", ["share_slug"], unique=True)

    # --- roast_reactions ---------------------------------------------------
    op.create_table(
        "roast_reactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("roast_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("reaction", _enum("reactiontype", *REACTION_TYPE), nullable=False),
        _ts("created_at"),
        sa.UniqueConstraint(
            "roast_id",
            "user_id",
            "reaction",
            name=op.f("uq_roast_reactions_roast_id_user_id_reaction"),
        ),
        sa.ForeignKeyConstraint(
            ["roast_id"],
            ["roasts.id"],
            name=op.f("fk_roast_reactions_roast_id_roasts"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_roast_reactions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roast_reactions")),
    )
    op.create_index(
        op.f("ix_roast_reactions_roast_id"), "roast_reactions", ["roast_id"], unique=False
    )
    op.create_index(
        op.f("ix_roast_reactions_user_id"), "roast_reactions", ["user_id"], unique=False
    )


def downgrade() -> None:
    """Drop all tables in reverse dependency order."""
    op.drop_index(op.f("ix_roast_reactions_user_id"), table_name="roast_reactions")
    op.drop_index(op.f("ix_roast_reactions_roast_id"), table_name="roast_reactions")
    op.drop_table("roast_reactions")

    op.drop_index(op.f("ix_roasts_share_slug"), table_name="roasts")
    op.drop_index(op.f("ix_roasts_review_id"), table_name="roasts")
    op.drop_table("roasts")

    op.drop_index(
        op.f("ix_review_criterion_scores_criterion_id"), table_name="review_criterion_scores"
    )
    op.drop_index(
        op.f("ix_review_criterion_scores_review_id"), table_name="review_criterion_scores"
    )
    op.drop_table("review_criterion_scores")

    op.drop_index(op.f("ix_reviews_submission_id"), table_name="reviews")
    op.drop_table("reviews")

    op.drop_index(op.f("ix_submission_files_submission_id"), table_name="submission_files")
    op.drop_table("submission_files")

    op.drop_index("ix_submissions_assignment_id_student_id", table_name="submissions")
    op.drop_index(op.f("ix_submissions_status"), table_name="submissions")
    op.drop_index(op.f("ix_submissions_student_id"), table_name="submissions")
    op.drop_index(op.f("ix_submissions_assignment_id"), table_name="submissions")
    op.drop_table("submissions")

    op.drop_index(op.f("ix_rubric_criteria_assignment_id"), table_name="rubric_criteria")
    op.drop_table("rubric_criteria")

    op.drop_index(op.f("ix_assignments_created_by"), table_name="assignments")
    op.drop_index(op.f("ix_assignments_course_id"), table_name="assignments")
    op.drop_table("assignments")

    op.drop_index(op.f("ix_course_enrollments_student_id"), table_name="course_enrollments")
    op.drop_index(op.f("ix_course_enrollments_course_id"), table_name="course_enrollments")
    op.drop_table("course_enrollments")

    op.drop_index(op.f("ix_courses_join_code"), table_name="courses")
    op.drop_index(op.f("ix_courses_instructor_id"), table_name="courses")
    op.drop_table("courses")

    op.drop_index(op.f("ix_refresh_tokens_user_id"), table_name="refresh_tokens")
    op.drop_table("refresh_tokens")

    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
