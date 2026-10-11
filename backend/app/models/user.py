"""User accounts and refresh tokens."""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, false, func, text, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, str_enum, utcnow
from app.models.enums import SpiceLevel, UserRole

if TYPE_CHECKING:
    from app.models.course import Course, CourseEnrollment
    from app.models.roast import RoastReaction
    from app.models.submission import Submission


class User(TimestampMixin, Base):
    """A student, instructor or admin account (password and/or Google OAuth)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        str_enum(UserRole),
        nullable=False,
        default=UserRole.student,
        server_default=text("'student'"),
    )
    default_spice_level: Mapped[SpiceLevel] = mapped_column(
        str_enum(SpiceLevel),
        nullable=False,
        default=SpiceLevel.medium,
        server_default=text("'medium'"),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=true()
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    oauth_provider: Mapped[str | None] = mapped_column(String(20), nullable=True)

    courses_taught: Mapped[list["Course"]] = relationship(
        back_populates="instructor", foreign_keys="Course.instructor_id"
    )
    enrollments: Mapped[list["CourseEnrollment"]] = relationship(
        back_populates="student", cascade="all, delete-orphan", passive_deletes=True
    )
    submissions: Mapped[list["Submission"]] = relationship(
        back_populates="student", cascade="all, delete-orphan", passive_deletes=True
    )
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    roast_reactions: Mapped[list["RoastReaction"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role}>"


class RefreshToken(Base):
    """A hashed, revocable refresh token issued to a user."""

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")

    def __repr__(self) -> str:
        return f"<RefreshToken id={self.id} user_id={self.user_id} revoked={self.revoked}>"
