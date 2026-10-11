"""CamelModel serialisation rules."""

from datetime import UTC, datetime

from app.schemas.base import CamelModel


class _Sample(CamelModel):
    created_at: datetime
    note: str = "x"


def test_naive_datetime_serialised_as_utc() -> None:
    dumped = _Sample(created_at=datetime(2026, 10, 10, 12, 0, 0)).model_dump(  # noqa: DTZ001
        mode="json", by_alias=True
    )
    assert dumped["createdAt"].endswith(("Z", "+00:00"))


def test_aware_datetime_is_kept() -> None:
    value = datetime(2026, 10, 10, 12, 0, 0, tzinfo=UTC)
    assert _Sample(created_at=value).created_at == value
