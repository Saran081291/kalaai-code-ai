"""Schemas for the Roast Wall, reactions, leaderboard and public roast cards.

Shapes mirror ``frontend/src/types/roast.ts`` field-for-field (camelCase JSON).
"""

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.models.enums import ReactionType, SpiceLevel
from app.schemas.base import CamelModel

RoastWallSort = Literal["recent", "top"]

# Every reaction key, in display order; counts always include all of them.
REACTION_KEYS: tuple[ReactionType, ...] = tuple(ReactionType)


def empty_reaction_counts() -> dict[str, int]:
    """Return ``{"fire": 0, "laugh": 0, "skull": 0, "clap": 0}``."""
    return {reaction.value: 0 for reaction in REACTION_KEYS}


class RoastShareRequest(CamelModel):
    """Body of ``PUT /roasts/{id}/share``: ``{"isShared": bool}``."""

    is_shared: bool


class ReactionRequest(CamelModel):
    """Body of ``POST /roasts/{id}/reactions``: ``{"reaction": "fire"}``."""

    reaction: ReactionType


class ReactionSummary(CamelModel):
    """Reaction totals for one roast plus the caller's own reactions."""

    roast_id: int
    reaction_counts: dict[str, int] = Field(default_factory=empty_reaction_counts)
    my_reactions: list[ReactionType] = Field(default_factory=list)


class RoastWallItem(CamelModel):
    """One card on ``GET /courses/{id}/roast-wall``."""

    id: int
    punchline: str
    content: str
    spice_level: SpiceLevel
    student_name: str
    student_avatar_url: str | None = None
    assignment_title: str
    effective_score: int | None = None
    max_score: int
    reaction_counts: dict[str, int] = Field(default_factory=empty_reaction_counts)
    my_reactions: list[ReactionType] = Field(default_factory=list)
    created_at: datetime


class LeaderboardEntry(CamelModel):
    """One row of ``GET /courses/{id}/leaderboard`` (ordered by ``rank``)."""

    rank: int
    student_id: int
    student_name: str
    avatar_url: str | None = None
    total_score: int
    assignments_completed: int


class PublicRoast(CamelModel):
    """Public share card: punchline, spice, score and first name only.

    Deliberately excludes the full roast text, code, email and internal ids.
    """

    punchline: str
    spice_level: SpiceLevel
    effective_score: int
    max_score: int
    student_first_name: str


__all__ = [
    "REACTION_KEYS",
    "LeaderboardEntry",
    "PublicRoast",
    "ReactionRequest",
    "ReactionSummary",
    "RoastShareRequest",
    "RoastWallItem",
    "RoastWallSort",
    "empty_reaction_counts",
]
