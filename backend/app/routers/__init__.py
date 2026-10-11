"""API routers. Every module router is mounted under ``/api/v1``."""

from fastapi import APIRouter

from app.routers import (
    assignments,
    auth,
    courses,
    dashboard,
    public,
    reviews,
    roasts,
    submissions,
    wall,
)

api_router = APIRouter(prefix="/api/v1")

# Each module router declares full sub-paths and its own tags.
api_router.include_router(auth.router)
api_router.include_router(courses.router)
api_router.include_router(assignments.router)
api_router.include_router(submissions.router)
api_router.include_router(reviews.router)
api_router.include_router(roasts.router)
api_router.include_router(wall.router)
api_router.include_router(public.router)
api_router.include_router(dashboard.router)

__all__ = ["api_router"]
