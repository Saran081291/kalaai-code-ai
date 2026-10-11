"""Roast Wall business logic: sharing, the course wall feed and reactions.

Visibility rules:
- Only roasts with ``is_shared = true`` and ``is_hidden = false`` appear on the wall,
  can receive reactions, or are reachable via the public share slug.
- Only course members (instructor/admin or enrolled students) see the wall and react.
- Only the student who submitted the code can share/unshare its roast.
"""

import logging
import secrets
from collections.abc import Sequence
from typing import TypeVarTuple

from sqlalchemy import Select, delete, exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models import (
    Assignment,
    Course,
    ReactionType,
    Review,
    Roast,
    RoastReaction,
    Submission,
    User,
)
from app.schemas.base import Page
from app.schemas.wall import (
    ReactionSummary,
    RoastWallItem,
    RoastWallSort,
    empty_reaction_counts,
)
from app.services.access import ensure_course_member, get_roast_or_404, roast_course

logger = logging.getLogger(__name__)

FALLBACK_FIRST_NAME = "Thambi"


def first_name(full_name: str | None) -> str:
    """Return the first whitespace-separated token of ``full_name`` (or ``"Thambi"``)."""
    tokens = (full_name or "").split()
    return tokens[0] if tokens else FALLBACK_FIRST_NAME


SHARE_SLUG_LENGTH = 10
_Ts = TypeVarTuple("_Ts")
_MAX_SLUG_ATTEMPTS = 10


# --- Sharing -------------------------------------------------------------------


def _slug_taken(db: Session, slug: str) -> bool:
    """Return True if another roast already uses ``slug``."""
    return bool(db.scalar(select(exists().where(Roast.share_slug == slug))))


def generate_share_slug(db: Session) -> str:
    """Generate a unique 10-character URL-safe share slug.

    Raises:
        ConflictError: if no free slug was found after several attempts (practically never).
    """
    for _ in range(_MAX_SLUG_ATTEMPTS):
        slug = secrets.token_urlsafe(8)[:SHARE_SLUG_LENGTH]
        if not _slug_taken(db, slug):
            return slug
    logger.error("Could not generate a unique share slug after %d attempts", _MAX_SLUG_ATTEMPTS)
    raise ConflictError("Could not generate a share link, please retry", code="SLUG_COLLISION")


def set_roast_shared(db: Session, roast_id: int, user: User, is_shared: bool) -> Roast:
    """Share or unshare a roast on the course wall / public link.

    The first share assigns a permanent ``share_slug``; unsharing keeps the slug, but the
    public endpoint and the wall then stop serving the roast.

    Args:
        db: Database session
        roast_id: Roast to update
        user: Current user; must be the student who owns the submission
        is_shared: New sharing state

    Returns:
        The updated Roast.

    Raises:
        NotFoundError: roast does not exist
        ForbiddenError: caller is not the submission's student (``NOT_ROAST_OWNER``)
        ConflictError: sharing a roast hidden by the instructor (``ROAST_HIDDEN``)
    """
    roast = get_roast_or_404(db, roast_id)
    student_id = db.scalar(
        select(Submission.student_id)
        .join(Review, Review.submission_id == Submission.id)
        .where(Review.id == roast.review_id)
    )
    if student_id != user.id:
        raise ForbiddenError(
            "Only the student who submitted can share this roast", "NOT_ROAST_OWNER"
        )
    if is_shared and roast.is_hidden:
        raise ConflictError("This roast was hidden by your instructor", code="ROAST_HIDDEN")

    if roast.is_shared == is_shared and (not is_shared or roast.share_slug):
        return roast

    for attempt in range(_MAX_SLUG_ATTEMPTS):
        if is_shared and not roast.share_slug:
            roast.share_slug = generate_share_slug(db)
        roast.is_shared = is_shared
        try:
            db.commit()
        except IntegrityError:
            # Slug race with a concurrent share: roll back and pick a fresh slug.
            db.rollback()
            roast = get_roast_or_404(db, roast_id)
            roast.share_slug = None
            logger.warning("Share slug collision for roast %s (attempt %d)", roast_id, attempt + 1)
            continue
        db.refresh(roast)
        logger.info("Roast %s share state set to %s by user %s", roast.id, is_shared, user.id)
        return roast
    raise ConflictError("Could not generate a share link, please retry", code="SLUG_COLLISION")


# --- Reactions -------------------------------------------------------------------


def _reaction_counts_for(db: Session, roast_ids: Sequence[int]) -> dict[int, dict[str, int]]:
    """Return per-roast reaction counts (all 4 keys, zero-filled) using one GROUP BY query."""
    counts: dict[int, dict[str, int]] = {rid: empty_reaction_counts() for rid in roast_ids}
    if not roast_ids:
        return counts
    rows = db.execute(
        select(RoastReaction.roast_id, RoastReaction.reaction, func.count(RoastReaction.id))
        .where(RoastReaction.roast_id.in_(roast_ids))
        .group_by(RoastReaction.roast_id, RoastReaction.reaction)
    ).all()
    for roast_id, reaction, count in rows:
        counts[roast_id][ReactionType(reaction).value] = int(count)
    return counts


def _my_reactions_for(
    db: Session, roast_ids: Sequence[int], user_id: int
) -> dict[int, list[ReactionType]]:
    """Return the reactions ``user_id`` left on each roast (one query)."""
    mine: dict[int, list[ReactionType]] = {rid: [] for rid in roast_ids}
    if not roast_ids:
        return mine
    rows = db.execute(
        select(RoastReaction.roast_id, RoastReaction.reaction)
        .where(RoastReaction.roast_id.in_(roast_ids), RoastReaction.user_id == user_id)
        .order_by(RoastReaction.roast_id, RoastReaction.id)
    ).all()
    for roast_id, reaction in rows:
        mine[roast_id].append(ReactionType(reaction))
    return mine


def _get_wall_roast_for_member(db: Session, roast_id: int, user: User) -> Roast:
    """Load a roast that is on the wall (shared, not hidden) and that ``user`` may see.

    Raises:
        NotFoundError: roast missing, not shared, or hidden
        ForbiddenError: caller is not a member of the roast's course
    """
    roast = get_roast_or_404(db, roast_id)
    if not roast.is_shared or roast.is_hidden:
        raise NotFoundError("Roast not found")
    ensure_course_member(db, roast_course(roast), user)
    return roast


def reaction_summary(db: Session, roast_id: int, user_id: int) -> ReactionSummary:
    """Build the ``ReactionSummary`` for one roast and user."""
    counts = _reaction_counts_for(db, [roast_id])[roast_id]
    mine = _my_reactions_for(db, [roast_id], user_id)[roast_id]
    return ReactionSummary(roast_id=roast_id, reaction_counts=counts, my_reactions=mine)


def add_reaction(db: Session, roast_id: int, user: User, reaction: ReactionType) -> ReactionSummary:
    """Add the user's ``reaction`` to a wall roast (idempotent).

    Returns:
        Updated reaction counts and the caller's reactions.
    """
    _get_wall_roast_for_member(db, roast_id, user)
    already = db.scalar(
        select(
            exists().where(
                RoastReaction.roast_id == roast_id,
                RoastReaction.user_id == user.id,
                RoastReaction.reaction == reaction,
            )
        )
    )
    if not already:
        db.add(RoastReaction(roast_id=roast_id, user_id=user.id, reaction=reaction))
        try:
            db.commit()
        except IntegrityError:
            # Concurrent duplicate insert - the reaction exists, which is what we want.
            db.rollback()
    return reaction_summary(db, roast_id, user.id)


def remove_reaction(
    db: Session, roast_id: int, user: User, reaction: ReactionType
) -> ReactionSummary:
    """Remove the user's ``reaction`` from a wall roast (idempotent).

    Returns:
        Updated reaction counts and the caller's reactions.
    """
    _get_wall_roast_for_member(db, roast_id, user)
    db.execute(
        delete(RoastReaction).where(
            RoastReaction.roast_id == roast_id,
            RoastReaction.user_id == user.id,
            RoastReaction.reaction == reaction,
        )
    )
    db.commit()
    return reaction_summary(db, roast_id, user.id)


# --- Wall feed -------------------------------------------------------------------


def _on_course_wall(stmt: Select[*_Ts], course_id: int) -> Select[*_Ts]:
    """Join ``Roast`` -> Review -> Submission -> Assignment and keep wall-visible roasts."""
    return (
        stmt.join(Review, Review.id == Roast.review_id)
        .join(Submission, Submission.id == Review.submission_id)
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .where(Assignment.course_id == course_id, Roast.is_shared, ~Roast.is_hidden)
    )


def get_roast_wall(
    db: Session,
    course: Course,
    user: User,
    sort: RoastWallSort = "recent",
    page: int = 1,
    page_size: int = 20,
) -> Page[RoastWallItem]:
    """Return a page of the course Roast Wall.

    ``recent`` orders by last update (sharing bumps it) then creation, newest first;
    ``top`` orders by total reaction count, then recent. Uses a fixed number of
    queries (count, page, grouped reaction counts, my reactions) - no N+1.

    Raises:
        ForbiddenError: caller is not a course member (``NOT_COURSE_MEMBER``)
    """
    ensure_course_member(db, course, user)

    total = db.scalar(_on_course_wall(select(func.count(Roast.id)), course.id)) or 0

    effective = func.coalesce(Review.instructor_override_score, Review.total_score)
    columns = select(
        Roast.id,
        Roast.punchline,
        Roast.content,
        Roast.spice_level,
        Roast.created_at,
        User.full_name,
        User.avatar_url,
        Assignment.title,
        Assignment.max_score,
        effective.label("effective_score"),
    ).select_from(Roast)
    stmt = _on_course_wall(columns, course.id).join(User, User.id == Submission.student_id)
    recent_order = (Roast.updated_at.desc(), Roast.created_at.desc(), Roast.id.desc())
    if sort == "top":
        reaction_totals = (
            select(RoastReaction.roast_id, func.count(RoastReaction.id).label("total"))
            .group_by(RoastReaction.roast_id)
            .subquery()
        )
        stmt = stmt.outerjoin(reaction_totals, reaction_totals.c.roast_id == Roast.id).order_by(
            func.coalesce(reaction_totals.c.total, 0).desc(), *recent_order
        )
    else:
        stmt = stmt.order_by(*recent_order)
    rows = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).all()

    roast_ids = [row.id for row in rows]
    counts = _reaction_counts_for(db, roast_ids)
    mine = _my_reactions_for(db, roast_ids, user.id)
    items = [
        RoastWallItem(
            id=row.id,
            punchline=row.punchline,
            content=row.content,
            spice_level=row.spice_level,
            student_name=first_name(row.full_name),
            student_avatar_url=row.avatar_url,
            assignment_title=row.title,
            effective_score=row.effective_score,
            max_score=row.max_score,
            reaction_counts=counts[row.id],
            my_reactions=mine[row.id],
            created_at=row.created_at,
        )
        for row in rows
    ]
    return Page[RoastWallItem](items=items, total=int(total), page=page, page_size=page_size)


__all__ = [
    "SHARE_SLUG_LENGTH",
    "add_reaction",
    "generate_share_slug",
    "get_roast_wall",
    "reaction_summary",
    "remove_reaction",
    "set_roast_shared",
]
