"""Shared slowapi limiter. Decorate routes with ``@limiter.limit("5/minute")``.

Routes using the decorator must accept a ``request: Request`` parameter.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

limiter = Limiter(key_func=get_remote_address, enabled=settings.RATE_LIMIT_ENABLED)
