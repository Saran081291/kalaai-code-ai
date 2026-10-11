"""Application exceptions rendered as ``{"detail": ..., "code": ...}`` JSON."""


class AppError(Exception):
    """Base class for expected, client-facing application errors."""

    status_code: int = 500
    code: str = "INTERNAL_ERROR"
    default_detail: str = "Internal server error"

    def __init__(self, detail: str | None = None, code: str | None = None) -> None:
        self.detail = detail if detail is not None else self.default_detail
        if code is not None:
            self.code = code
        super().__init__(self.detail)


class BadRequestError(AppError):
    """400 - malformed or semantically invalid request."""

    status_code = 400
    code = "BAD_REQUEST"
    default_detail = "Bad request"


class UnauthorizedError(AppError):
    """401 - missing or invalid credentials."""

    status_code = 401
    code = "UNAUTHORIZED"
    default_detail = "Not authenticated"


class ForbiddenError(AppError):
    """403 - authenticated but lacking role or ownership."""

    status_code = 403
    code = "FORBIDDEN"
    default_detail = "You do not have permission to perform this action"


class NotFoundError(AppError):
    """404 - resource does not exist (or is not visible to the caller)."""

    status_code = 404
    code = "NOT_FOUND"
    default_detail = "Resource not found"


class ConflictError(AppError):
    """409 - duplicate resource or business-rule conflict (e.g. attempt limit)."""

    status_code = 409
    code = "CONFLICT"
    default_detail = "Conflict"


class PayloadTooLargeError(AppError):
    """413 - upload exceeds configured size/file-count limits."""

    status_code = 413
    code = "PAYLOAD_TOO_LARGE"
    default_detail = "Payload too large"
