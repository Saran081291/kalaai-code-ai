"""Public (unauthenticated) endpoints: shareable roast cards."""

from fastapi import APIRouter, Request
from sqlalchemy import func, select

from app.auth.dependencies import DbSession
from app.exceptions import NotFoundError
from app.models import Assignment, Review, Roast, Submission, User
from app.rate_limit import limiter
from app.schemas.wall import PublicRoast
from app.services.wall_service import first_name

router = APIRouter(tags=["public"])


@router.get("/public/roasts/{slug}", response_model=PublicRoast)
@limiter.limit("60/minute")
def get_public_roast(request: Request, slug: str, db: DbSession) -> PublicRoast:
    """Return a shared roast card by its share slug - no auth required.

    Only exposes the punchline, spice level, score and the student's first name.
    Never the full roast text, code, email, file contents or internal ids.
    404 unless the roast is currently shared and not hidden.
    """
    row = db.execute(
        select(
            Roast.punchline,
            Roast.spice_level,
            func.coalesce(Review.instructor_override_score, Review.total_score).label(
                "effective_score"
            ),
            Assignment.max_score,
            User.full_name,
        )
        .select_from(Roast)
        .join(Review, Review.id == Roast.review_id)
        .join(Submission, Submission.id == Review.submission_id)
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .join(User, User.id == Submission.student_id)
        .where(Roast.share_slug == slug, Roast.is_shared, ~Roast.is_hidden)
    ).one_or_none()
    if row is None:
        raise NotFoundError("Roast not found")
    return PublicRoast(
        punchline=row.punchline,
        spice_level=row.spice_level,
        effective_score=row.effective_score,
        max_score=row.max_score,
        student_first_name=first_name(row.full_name),
    )


__all__ = ["router"]
