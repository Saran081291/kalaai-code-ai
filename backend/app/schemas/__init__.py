"""Pydantic request/response schemas (camelCase JSON via ``CamelModel``)."""

from app.schemas.base import CamelModel, ErrorResponse, MessageResponse, Page

__all__ = ["CamelModel", "ErrorResponse", "MessageResponse", "Page"]
