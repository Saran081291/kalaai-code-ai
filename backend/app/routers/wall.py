"""Roast Wall & Leaderboard endpoints: sharing, wall feed, reactions, leaderboard.

Handlers are plain ``def`` (run in the threadpool) because they only do sync DB work.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import CurrentUser, DbSession
from app.dependencies import PaginationParams
from app.models import ReactionType
from app.schemas.base import Page
from app.schemas.wall import (
    LeaderboardEntry,
    ReactionRequest,
    ReactionSummary,
    RoastShareRequest,
    RoastWallItem,
    RoastWallSort,
)
from app.services import leaderboard_service, wall_service
from app.services.access import ensure_course_member, get_course_or_404

router = APIRouter(tags=["wall"])


@router.put(
    "/roasts/{roast_id}/share",
    responses={
        200: {"description": "The updated Roast (same shape as GET /submissions/{id}/roast)"}
    },
)
def share_roast(
    roast_id: int, body: RoastShareRequest, db: DbSession, user: CurrentUser
) -> dict[str, Any]:
    """Share/unshare the caller's own roast. First share generates the ``shareSlug``.

    Errors: 403 ``NOT_ROAST_OWNER``, 404 roast missing, 409 ``ROAST_HIDDEN``.
    """
    # Imported lazily: ``RoastOut`` is owned by the review module.
    from app.schemas.roast import RoastOut

    roast = wall_service.set_roast_shared(db, roast_id, user, body.is_shared)
    return RoastOut.model_validate(roast).model_dump(mode="json", by_alias=True)


@router.get("/courses/{course_id}/roast-wall", response_model=Page[RoastWallItem])
def get_roast_wall(
    course_id: int,
    db: DbSession,
    user: CurrentUser,
    pagination: Annotated[PaginationParams, Depends()],
    sort: Annotated[RoastWallSort, Query()] = "recent",
) -> Page[RoastWallItem]:
    """Paginated shared roasts of a course (course members only, 403 ``NOT_COURSE_MEMBER``)."""
    course = get_course_or_404(db, course_id)
    return wall_service.get_roast_wall(
        db, course, user, sort=sort, page=pagination.page, page_size=pagination.page_size
    )


@router.post("/roasts/{roast_id}/reactions", response_model=ReactionSummary)
def add_reaction(
    roast_id: int, body: ReactionRequest, db: DbSession, user: CurrentUser
) -> ReactionSummary:
    """React to a wall roast (idempotent). 404 unless shared & visible; 403 for non-members."""
    return wall_service.add_reaction(db, roast_id, user, body.reaction)


@router.delete("/roasts/{roast_id}/reactions/{reaction}", response_model=ReactionSummary)
def remove_reaction(
    roast_id: int, reaction: ReactionType, db: DbSession, user: CurrentUser
) -> ReactionSummary:
    """Remove the caller's reaction (idempotent). Returns the updated summary."""
    return wall_service.remove_reaction(db, roast_id, user, reaction)


@router.get("/courses/{course_id}/leaderboard", response_model=list[LeaderboardEntry])
def get_leaderboard(course_id: int, db: DbSession, user: CurrentUser) -> list[LeaderboardEntry]:
    """Ranked course leaderboard (course members only, 403 ``NOT_COURSE_MEMBER``)."""
    course = get_course_or_404(db, course_id)
    ensure_course_member(db, course, user)
    return leaderboard_service.compute_leaderboard(db, course.id)


__all__ = ["router"]
