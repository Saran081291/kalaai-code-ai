"""Tests for the Roast Wall: sharing, wall feed, reactions and public roast cards."""

from collections.abc import Iterator
from dataclasses import dataclass
from datetime import timedelta
from itertools import count
from pathlib import Path

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.auth.security import create_access_token
from app.database import Base, get_db
from app.main import app
from app.models import (
    Assignment,
    Course,
    CourseEnrollment,
    ProgrammingLanguage,
    Review,
    Roast,
    RoastReaction,
    SourceType,
    SpiceLevel,
    Submission,
    SubmissionFile,
    SubmissionStatus,
    User,
    UserRole,
)
from app.models.base import utcnow
from app.routers import public as public_router
from app.routers import wall as wall_router

API = "/api/v1"

if not any(
    getattr(r, "path", None) == f"{API}/courses/{{course_id}}/roast-wall" for r in app.routes
):
    _api = APIRouter(prefix=API)
    _api.include_router(wall_router.router)
    _api.include_router(public_router.router)
    app.include_router(_api)

_seq = count(1)


# --------------------------------------------------------------------------- #
# Fixtures + factories
# --------------------------------------------------------------------------- #


@pytest.fixture()
def db(tmp_path: Path) -> Iterator[Session]:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'wall.db'}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def _override_get_db() -> Iterator[Session]:
        session = factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = _override_get_db
    session = factory()
    try:
        yield session
    finally:
        session.close()
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


@pytest.fixture()
def client(db: Session) -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


def make_user(db: Session, name: str, role: UserRole = UserRole.student) -> User:
    n = next(_seq)
    user = User(email=f"user{n}@example.com", full_name=name, role=role)
    db.add(user)
    db.commit()
    return user


def auth(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}


def make_course(db: Session, instructor: User, students: list[User]) -> Course:
    n = next(_seq)
    course = Course(instructor_id=instructor.id, name=f"Course {n}", join_code=f"JC{n:06d}")
    db.add(course)
    db.flush()
    for student in students:
        db.add(CourseEnrollment(course_id=course.id, student_id=student.id))
    db.commit()
    return course


def make_assignment(db: Session, course: Course, title: str = "Bun Parotta API") -> Assignment:
    assignment = Assignment(
        course_id=course.id,
        created_by=course.instructor_id,
        title=title,
        description="Build it",
        language=ProgrammingLanguage.python,
        max_score=100,
        is_published=True,
    )
    db.add(assignment)
    db.commit()
    return assignment


@dataclass
class RoastBundle:
    submission: Submission
    review: Review
    roast: Roast


_attempts: dict[tuple[int, int], int] = {}


def make_roast(
    db: Session,
    assignment: Assignment,
    student: User,
    *,
    score: int = 70,
    override: int | None = None,
    shared: bool = False,
    hidden: bool = False,
    minutes_ago: int = 0,
) -> RoastBundle:
    key = (assignment.id, student.id)
    _attempts[key] = _attempts.get(key, 0) + 1
    submission = Submission(
        assignment_id=assignment.id,
        student_id=student.id,
        attempt_number=_attempts[key],
        source_type=SourceType.upload,
        spice_level=SpiceLevel.medium,
        status=SubmissionStatus.completed,
    )
    db.add(submission)
    db.flush()
    db.add(
        SubmissionFile(
            submission_id=submission.id,
            path="main.py",
            language="python",
            size_bytes=20,
            content="SECRET_CODE = 'do-not-leak'",
        )
    )
    review = Review(
        submission_id=submission.id,
        total_score=score,
        instructor_override_score=override,
        summary="Okay-ish",
        model_used="test-model",
    )
    db.add(review)
    db.flush()
    stamp = utcnow() - timedelta(minutes=minutes_ago)
    n = next(_seq)
    roast = Roast(
        review_id=review.id,
        spice_level=SpiceLevel.mass,
        content=f"Enna ya thambi, roast {n}",
        punchline=f"Punchline {n}",
        is_shared=shared,
        is_hidden=hidden,
        share_slug=f"slug{n:06d}" if shared else None,
        created_at=stamp,
        updated_at=stamp,
    )
    db.add(roast)
    db.commit()
    return RoastBundle(submission, review, roast)


@dataclass
class World:
    instructor: User
    alice: User
    bob: User
    outsider: User
    course: Course
    assignment: Assignment


@pytest.fixture()
def world(db: Session) -> World:
    instructor = make_user(db, "Prof Meenakshi", UserRole.instructor)
    alice = make_user(db, "Alice Kumar")
    bob = make_user(db, "Bob Raja")
    outsider = make_user(db, "Out Sider")
    course = make_course(db, instructor, [alice, bob])
    return World(instructor, alice, bob, outsider, course, make_assignment(db, course))


# --------------------------------------------------------------------------- #
# Share
# --------------------------------------------------------------------------- #


def test_share_generates_slug_and_unshare_keeps_it(
    client: TestClient, db: Session, world: World
) -> None:
    bundle = make_roast(db, world.assignment, world.alice)
    url = f"{API}/roasts/{bundle.roast.id}/share"

    res = client.put(url, json={"isShared": True}, headers=auth(world.alice))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["id"] == bundle.roast.id
    assert body["isShared"] is True
    slug = body["shareSlug"]
    assert isinstance(slug, str) and len(slug) == 10
    assert {"reviewId", "regenerateCount", "isHidden", "createdAt", "updatedAt"} <= body.keys()

    public = client.get(f"{API}/public/roasts/{slug}")
    assert public.status_code == 200

    res = client.put(url, json={"isShared": False}, headers=auth(world.alice))
    assert res.status_code == 200
    assert res.json()["isShared"] is False
    assert res.json()["shareSlug"] == slug

    assert client.get(f"{API}/public/roasts/{slug}").status_code == 404

    # Re-sharing reuses the same slug.
    res = client.put(url, json={"isShared": True}, headers=auth(world.alice))
    assert res.json()["shareSlug"] == slug


def test_only_owner_can_share(client: TestClient, db: Session, world: World) -> None:
    bundle = make_roast(db, world.assignment, world.alice)
    url = f"{API}/roasts/{bundle.roast.id}/share"
    for other in (world.bob, world.instructor):
        res = client.put(url, json={"isShared": True}, headers=auth(other))
        assert res.status_code == 403
        assert res.json()["code"] == "NOT_ROAST_OWNER"
    assert client.put(url, json={"isShared": True}).status_code == 401
    assert (
        client.put(f"{API}/roasts/999999/share", json={"isShared": True}, headers=auth(world.alice))
    ).status_code == 404


def test_hidden_roast_cannot_be_shared(client: TestClient, db: Session, world: World) -> None:
    bundle = make_roast(db, world.assignment, world.alice, hidden=True)
    res = client.put(
        f"{API}/roasts/{bundle.roast.id}/share",
        json={"isShared": True},
        headers=auth(world.alice),
    )
    assert res.status_code == 409
    assert res.json()["code"] == "ROAST_HIDDEN"


# --------------------------------------------------------------------------- #
# Wall
# --------------------------------------------------------------------------- #


def test_wall_requires_membership(client: TestClient, db: Session, world: World) -> None:
    url = f"{API}/courses/{world.course.id}/roast-wall"
    res = client.get(url, headers=auth(world.outsider))
    assert res.status_code == 403
    assert res.json()["code"] == "NOT_COURSE_MEMBER"
    assert client.get(url).status_code == 401
    assert client.get(url, headers=auth(world.instructor)).status_code == 200
    assert client.get(url, headers=auth(world.bob)).status_code == 200
    assert (
        client.get(f"{API}/courses/999999/roast-wall", headers=auth(world.alice)).status_code == 404
    )


def test_wall_only_shows_shared_visible_roasts_of_course(
    client: TestClient, db: Session, world: World
) -> None:
    visible = make_roast(db, world.assignment, world.alice, shared=True, score=80, override=90)
    make_roast(db, world.assignment, world.alice)  # not shared
    make_roast(db, world.assignment, world.bob, shared=True, hidden=True)  # hidden
    other_course = make_course(db, world.instructor, [world.alice])
    make_roast(db, make_assignment(db, other_course), world.alice, shared=True)

    res = client.get(f"{API}/courses/{world.course.id}/roast-wall", headers=auth(world.bob))
    assert res.status_code == 200, res.text
    page = res.json()
    assert page["total"] == 1
    assert page["page"] == 1 and page["pageSize"] == 20
    (item,) = page["items"]
    assert item["id"] == visible.roast.id
    assert item["studentName"] == "Alice"  # first name only, never the surname
    assert "Kumar" not in res.text
    assert item["assignmentTitle"] == "Bun Parotta API"
    assert item["effectiveScore"] == 90  # override wins
    assert item["maxScore"] == 100
    assert item["spiceLevel"] == "mass"
    assert item["reactionCounts"] == {"fire": 0, "laugh": 0, "skull": 0, "clap": 0}
    assert item["myReactions"] == []
    assert {"punchline", "content", "studentAvatarUrl", "createdAt"} <= item.keys()


def test_wall_sorting_and_pagination(client: TestClient, db: Session, world: World) -> None:
    old = make_roast(db, world.assignment, world.alice, shared=True, minutes_ago=30)
    mid = make_roast(db, world.assignment, world.bob, shared=True, minutes_ago=20)
    new = make_roast(db, world.assignment, world.alice, shared=True, minutes_ago=10)
    for user in (world.alice, world.bob, world.instructor):
        db.add(RoastReaction(roast_id=old.roast.id, user_id=user.id, reaction="fire"))
    db.add(RoastReaction(roast_id=mid.roast.id, user_id=world.bob.id, reaction="clap"))
    db.commit()

    url = f"{API}/courses/{world.course.id}/roast-wall"
    recent = client.get(url, headers=auth(world.alice)).json()
    assert [i["id"] for i in recent["items"]] == [new.roast.id, mid.roast.id, old.roast.id]

    top = client.get(url, params={"sort": "top"}, headers=auth(world.alice)).json()
    assert [i["id"] for i in top["items"]] == [old.roast.id, mid.roast.id, new.roast.id]
    assert top["items"][0]["reactionCounts"] == {"fire": 3, "laugh": 0, "skull": 0, "clap": 0}
    assert top["items"][0]["myReactions"] == ["fire"]

    paged = client.get(
        url, params={"sort": "top", "page": 2, "pageSize": 2}, headers=auth(world.alice)
    ).json()
    assert paged["total"] == 3 and paged["page"] == 2 and paged["pageSize"] == 2
    assert [i["id"] for i in paged["items"]] == [new.roast.id]

    assert client.get(url, params={"sort": "bogus"}, headers=auth(world.alice)).status_code == 422


# --------------------------------------------------------------------------- #
# Reactions
# --------------------------------------------------------------------------- #


def test_reactions_counts_mine_and_idempotency(
    client: TestClient, db: Session, world: World
) -> None:
    bundle = make_roast(db, world.assignment, world.alice, shared=True)
    url = f"{API}/roasts/{bundle.roast.id}/reactions"

    res = client.post(url, json={"reaction": "fire"}, headers=auth(world.bob))
    assert res.status_code == 200, res.text
    assert res.json() == {
        "roastId": bundle.roast.id,
        "reactionCounts": {"fire": 1, "laugh": 0, "skull": 0, "clap": 0},
        "myReactions": ["fire"],
    }
    # Idempotent add.
    res = client.post(url, json={"reaction": "fire"}, headers=auth(world.bob))
    assert res.status_code == 200
    assert res.json()["reactionCounts"]["fire"] == 1

    client.post(url, json={"reaction": "skull"}, headers=auth(world.bob))
    res = client.post(url, json={"reaction": "fire"}, headers=auth(world.instructor))
    body = res.json()
    assert body["reactionCounts"] == {"fire": 2, "laugh": 0, "skull": 1, "clap": 0}
    assert body["myReactions"] == ["fire"]

    res = client.delete(f"{url}/fire", headers=auth(world.bob))
    assert res.status_code == 200
    assert res.json()["reactionCounts"] == {"fire": 1, "laugh": 0, "skull": 1, "clap": 0}
    assert res.json()["myReactions"] == ["skull"]
    # Idempotent delete.
    res = client.delete(f"{url}/fire", headers=auth(world.bob))
    assert res.status_code == 200
    assert res.json()["reactionCounts"]["fire"] == 1

    wall = client.get(f"{API}/courses/{world.course.id}/roast-wall", headers=auth(world.bob)).json()
    assert wall["items"][0]["myReactions"] == ["skull"]
    assert wall["items"][0]["reactionCounts"]["fire"] == 1

    assert client.post(url, json={"reaction": "angry"}, headers=auth(world.bob)).status_code == 422
    assert client.delete(f"{url}/angry", headers=auth(world.bob)).status_code == 422


def test_reactions_require_membership_and_visible_roast(
    client: TestClient, db: Session, world: World
) -> None:
    shared = make_roast(db, world.assignment, world.alice, shared=True)
    res = client.post(
        f"{API}/roasts/{shared.roast.id}/reactions",
        json={"reaction": "laugh"},
        headers=auth(world.outsider),
    )
    assert res.status_code == 403
    assert res.json()["code"] == "NOT_COURSE_MEMBER"
    res = client.delete(
        f"{API}/roasts/{shared.roast.id}/reactions/laugh", headers=auth(world.outsider)
    )
    assert res.status_code == 403

    unshared = make_roast(db, world.assignment, world.alice)
    hidden = make_roast(db, world.assignment, world.alice, shared=True, hidden=True)
    for roast_id in (unshared.roast.id, hidden.roast.id, 999999):
        res = client.post(
            f"{API}/roasts/{roast_id}/reactions",
            json={"reaction": "laugh"},
            headers=auth(world.bob),
        )
        assert res.status_code == 404


# --------------------------------------------------------------------------- #
# Public card
# --------------------------------------------------------------------------- #


def test_public_roast_exposes_only_card_fields(
    client: TestClient, db: Session, world: World
) -> None:
    bundle = make_roast(db, world.assignment, world.alice, shared=True, score=60, override=75)
    res = client.get(f"{API}/public/roasts/{bundle.roast.share_slug}")
    assert res.status_code == 200, res.text
    body = res.json()
    assert set(body) == {
        "punchline",
        "spiceLevel",
        "effectiveScore",
        "maxScore",
        "studentFirstName",
    }
    assert body["studentFirstName"] == "Alice"
    assert body["effectiveScore"] == 75
    assert body["maxScore"] == 100
    raw = res.text
    assert "example.com" not in raw
    assert "SECRET_CODE" not in raw
    assert "Kumar" not in raw
    for forbidden in ("email", "code", "files", "id", "studentId", "githubUrl"):
        assert forbidden not in body


def test_public_roast_404_when_not_public(client: TestClient, db: Session, world: World) -> None:
    unshared = make_roast(db, world.assignment, world.alice)
    unshared.roast.share_slug = "wasShared1"
    db.commit()
    hidden = make_roast(db, world.assignment, world.alice, shared=True, hidden=True)
    for slug in ("wasShared1", hidden.roast.share_slug, "nope"):
        res = client.get(f"{API}/public/roasts/{slug}")
        assert res.status_code == 404


def test_public_first_name_fallback(client: TestClient, db: Session, world: World) -> None:
    blank = make_user(db, "   ")
    db.add(CourseEnrollment(course_id=world.course.id, student_id=blank.id))
    db.commit()
    bundle = make_roast(db, world.assignment, blank, shared=True)
    res = client.get(f"{API}/public/roasts/{bundle.roast.share_slug}")
    assert res.json()["studentFirstName"] == "Thambi"
