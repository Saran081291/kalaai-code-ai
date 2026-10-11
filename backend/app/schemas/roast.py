"""Roast schemas: API responses/requests and the AI roast output contract."""

from datetime import datetime

from pydantic import Field

from app.models.enums import SpiceLevel
from app.schemas.base import CamelModel


class RoastOut(CamelModel):
    """A roast as returned to the frontend (``Roast`` type). Plain text only."""

    id: int
    review_id: int
    spice_level: SpiceLevel
    content: str
    punchline: str
    is_hidden: bool
    is_shared: bool
    share_slug: str | None = None
    regenerate_count: int
    created_at: datetime
    updated_at: datetime


class RoastRegenerateRequest(CamelModel):
    """Body of ``POST /roasts/{id}/regenerate``; omit ``spiceLevel`` to keep the current one."""

    spice_level: SpiceLevel | None = None


class RoastVisibilityRequest(CamelModel):
    """Body of ``PUT /roasts/{id}/visibility`` (instructor only)."""

    is_hidden: bool


class AIRoastOutput(CamelModel):
    """The structured JSON the roast model must return (checked by ``roast_guard``)."""

    content: str = Field(min_length=1)
    punchline: str = Field(min_length=1)


__all__ = ["AIRoastOutput", "RoastOut", "RoastRegenerateRequest", "RoastVisibilityRequest"]
