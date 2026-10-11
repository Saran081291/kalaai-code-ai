"""Add submissions.attempt_refunded (fetch failures do not use up an attempt).

Revision ID: 0002_attempt_refunded
Revises: 0001_initial
Create Date: 2026-10-11 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_attempt_refunded"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add the flag, defaulting existing rows to counted (False)."""
    op.add_column(
        "submissions",
        sa.Column(
            "attempt_refunded", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )


def downgrade() -> None:
    """Drop the flag."""
    op.drop_column("submissions", "attempt_refunded")
