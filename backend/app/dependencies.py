"""Shared FastAPI dependencies.

Auth dependencies (``get_current_user``, role guards) live in ``app.auth.dependencies``.
"""

from fastapi import Query

from app.database import get_db

__all__ = ["PaginationParams", "get_db"]


class PaginationParams:
    """Query-string pagination: ``?page=1&pageSize=20``.

    Use as ``pagination: PaginationParams = Depends()``.
    """

    def __init__(
        self,
        page: int = Query(1, ge=1, description="1-based page number"),
        page_size: int = Query(20, ge=1, le=100, alias="pageSize", description="Items per page"),
    ) -> None:
        self.page = page
        self.page_size = page_size

    @property
    def offset(self) -> int:
        """Number of rows to skip for the current page."""
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        """Maximum number of rows to return (alias of ``page_size``)."""
        return self.page_size
