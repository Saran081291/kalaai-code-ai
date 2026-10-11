"""Dashboard routes: ``GET /dashboard`` (role-based summary)."""

from fastapi import APIRouter

from app.auth.dependencies import CurrentUser, DbSession
from app.schemas.dashboard import DashboardResponse
from app.services import dashboard_service

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(user: CurrentUser, db: DbSession) -> DashboardResponse:
    """Return the student or instructor dashboard (admins get the instructor view).

    Plain ``def`` so the synchronous aggregate queries run in the threadpool.
    """
    return dashboard_service.get_dashboard(db, user)
