"""Madurai-style roasts and reactions on the Roast Wall."""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    false,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, str_enum, utcnow
from app.models.enums import ReactionType, SpiceLevel

if TYPE_CHECKING:
    from app.models.review import Review
    from app.models.user import User


class Roast(TimestampMixin, Base):
    """A humorous roast generated from a review (one per review)."""

    __tablename__ = "roasts"

    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(
        ForeignKey("reviews.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    spice_level: Mapped[SpiceLevel] = mapped_column(str_enum(SpiceLevel), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    punchline: Mapped[str] = mapped_column(String(140), nullable=False)
    is_hidden: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    is_shared: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    share_slug: Mapped[str | None] = mapped_column(
        String(16), unique=True, index=True, nullable=True
    )
    regenerate_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )

    review: Mapped["Review"] = relationship(back_populates="roast")
    reactions: Mapped[list["RoastReaction"]] = relationship(
        back_populates="roast", cascade="all, delete-orphan", passive_deletes=True
    )

    def __repr__(self) -> str:
        return f"<Roast id={self.id} review_id={self.review_id} spice={self.spice_level}>"


class RoastReaction(Base):
    """A single user's reaction of one type to a roast."""

    __tablename__ = "roast_reactions"
    __table_args__ = (UniqueConstraint("roast_id", "user_id", "reaction"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    roast_id: Mapped[int] = mapped_column(
        ForeignKey("roasts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    reaction: Mapped[ReactionType] = mapped_column(str_enum(ReactionType), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )

    roast: Mapped["Roast"] = relationship(back_populates="reactions")
    user: Mapped["User"] = relationship(back_populates="roast_reactions")

    def __repr__(self) -> str:
        return (
            f"<RoastReaction roast_id={self.roast_id} user_id={self.user_id} "
            f"reaction={self.reaction}>"
        )
