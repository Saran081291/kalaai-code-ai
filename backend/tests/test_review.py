"""Router tests for the AI review + roast endpoints (SQLite, mocked AI and fetcher)."""

from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
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
    RubricCriterion,
    SourceType,
    SpiceLevel,
    Submission,
    SubmissionStatus,
    User,
    UserRole,
)
from app.rate_limit import limiter
from app.routers import reviews as reviews_router
from app.routers import roasts as roasts_router
from app.services import ai_client, code_fetcher, pipeline

_PROBE = "/api/v1/submissions/{submission_id}/review"
if not any(getattr(route, "path", None) == _PROBE for route in app.routes):
    _api = APIRouter(prefix="/api/v1")
    _api.include_router(reviews_router.router)
    _api.include_router(roasts_router.router)
    app.include_router(_api)

ROAST = (
    "Enna ya thambi, input validation-a enga vittutta? User 'abc' type pannina un calculator "
    "summer Vaigai aaru maari dry-a nikkudhu, answer varala, crash mattum varudhu. Function "
    "names semma clear, adhu gethu. Oru chinna isdigit check pottu friendly error message "
    "kudu, rendu test case serthu paaru. Appo un code Meenakshi Amman kovil gopuram maari "
    "strong-a nikkum. Semma start thambi, next version-la nee kalakkiduva!"
)


class FakeAI:
    """Deterministic stand-in for ``ai_client.generate_structured``."""

    def __init__(self) -> None:
        self.criterion_ids: list[int] = []
        self.scores: tuple[int, int] = (50, 30)
        self.roast_calls = 0

    def __call__(self, **kwargs: Any) -> ai_client.AIResult:
        if kwargs["tool_name"] == "submit_review":
            data: dict[str, object] = {
                "summary": "Works; add validation.",
                "strengths": ["Clear names"],
                "criteria": [
                    {"criterionId": cid, "score": score, "feedback": "ok"}
                    for cid, score in zip(self.criterion_ids, self.scores, strict=True)
                ],
                "issues": [
                    {
                        "file": "calc.py",
                        "line": 4,
                        "severity": "major",
                        "category": "bug",
                        "message": "Crashes on bad input",
                        "suggestion": "Validate input",
                    }
                ],
            }
        else:
            self.roast_calls += 1
            data = {"content": f"{ROAST} Version {self.roast_calls}.", "punchline": "Semma!"}
        return ai_client.AIResult(
            data=data, model="claude-opus-5-5", input_tokens=10, output_tokens=5
        )


@pytest.fixture()
def factory(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[sessionmaker[Session]]:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'review.db'}", connect_args={"check_same_thread": False}
    )

    @event.listens_for(engine, "connect")
    def _fk_on(dbapi_connection: Any, _record: Any) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def _override_get_db() -> Iterator[Session]:
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = _override_get_db
    monkeypatch.setattr(pipeline, "SessionLocal", session_factory)
    limiter.reset()
    yield session_factory
    app.dependency_overrides.pop(get_db, None)
    engine.dispose()


@pytest.fixture()
def fake_ai(monkeypatch: pytest.MonkeyPatch) -> FakeAI:
    fake = FakeAI()
    monkeypatch.setattr(ai_client, "generate_structured", fake)
    files = [
        code_fetcher.CollectedFile(path="calc.py", language="python", size_bytes=5, content="x=1")
    ]
    monkeypatch.setattr(
        code_fetcher,
        "collect_uploaded_files",
        lambda _dir: code_fetcher.FetchResult(files=files, commit_sha=None),
    )
    return fake


@pytest.fixture()
def client(factory: sessionmaker[Session]) -> TestClient:
    return TestClient(app)


class World:
    def __init__(self, db: Session) -> None:
        self.instructor = User(email="t@example.com", full_name="Teacher", role=UserRole.instructor)
        self.other_instructor = User(
            email="t2@example.com", full_name="Teacher Two", role=UserRole.instructor
        )
        self.student = User(email="s@example.com", full_name="Student", role=UserRole.student)
        self.classmate = User(email="c@example.com", full_name="Classmate", role=UserRole.student)
        db.add_all([self.instructor, self.other_instructor, self.student, self.classmate])
        db.flush()
        course = Course(instructor_id=self.instructor.id, name="Python", join_code="JOIN1234")
        db.add(course)
        db.flush()
        db.add_all(
            [
                CourseEnrollment(course_id=course.id, student_id=self.student.id),
                CourseEnrollment(course_id=course.id, student_id=self.classmate.id),
            ]
        )
        assignment = Assignment(
            course_id=course.id,
            created_by=self.instructor.id,
            title="Calculator",
            description="Build it",
            language=ProgrammingLanguage.python,
            max_score=100,
            is_published=True,
        )
        db.add(assignment)
        db.flush()
        criteria = [
            RubricCriterion(
                assignment_id=assignment.id,
                name="Correctness",
                description="d",
                max_points=60,
                position=1,
            ),
            RubricCriterion(
                assignment_id=assignment.id,
                name="Quality",
                description="d",
                max_points=40,
                position=2,
            ),
        ]
        db.add_all(criteria)
        db.flush()
        self.criterion_ids = [c.id for c in criteria]
        submission = Submission(
            assignment_id=assignment.id,
            student_id=self.student.id,
            attempt_number=1,
            source_type=SourceType.upload,
            spice_level=SpiceLevel.medium,
        )
        db.add(submission)
        db.commit()
        self.submission_id = submission.id

    @staticmethod
    def auth(user: User) -> dict[str, str]:
        return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}


@pytest.fixture()
def world(factory: sessionmaker[Session], fake_ai: FakeAI) -> World:
    with factory() as db:
        w = World(db)
    fake_ai.criterion_ids = w.criterion_ids
    return w


def processed(world: World) -> None:
    pipeline.run_pipeline(world.submission_id)


def roast_id(factory: sessionmaker[Session]) -> int:
    with factory() as db:
        return db.scalars(select(Roast)).one().id


# ---------------------------------------------------------------------------
# Reviews
# ---------------------------------------------------------------------------


def test_review_not_ready_then_ready(client: TestClient, world: World) -> None:
    url = f"/api/v1/submissions/{world.submission_id}/review"
    res = client.get(url, headers=world.auth(world.student))
    assert res.status_code == 404
    assert res.json()["code"] == "REVIEW_NOT_READY"

    processed(world)
    res = client.get(url, headers=world.auth(world.student))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["submissionId"] == world.submission_id
    assert body["totalScore"] == 80
    assert body["effectiveScore"] == 80
    assert body["maxScore"] == 100
    assert body["modelUsed"] == "claude-opus-5-5"
    assert body["instructorOverrideScore"] is None
    assert [c["criterionName"] for c in body["criterionScores"]] == ["Correctness", "Quality"]
    assert [c["maxPoints"] for c in body["criterionScores"]] == [60, 40]
    assert body["issues"][0] == {
        "file": "calc.py",
        "line": 4,
        "severity": "major",
        "category": "bug",
        "message": "Crashes on bad input",
        "suggestion": "Validate input",
    }
    # Instructor can read it too; classmates cannot.
    assert client.get(url, headers=world.auth(world.instructor)).status_code == 200
    assert client.get(url, headers=world.auth(world.classmate)).status_code == 403
    assert client.get(url).status_code == 401


def test_override_changes_effective_score(
    client: TestClient, world: World, factory: sessionmaker[Session]
) -> None:
    processed(world)
    with factory() as db:
        review_id = db.scalars(select(Review)).one().id
    url = f"/api/v1/reviews/{review_id}/override"

    res = client.put(
        url,
        json={"overrideScore": 95, "comment": "Great README"},
        headers=world.auth(world.instructor),
    )
    assert res.status_code == 200, res.text
    assert res.json()["effectiveScore"] == 95
    assert res.json()["totalScore"] == 80
    assert res.json()["instructorComment"] == "Great README"

    res = client.put(url, json={"overrideScore": None}, headers=world.auth(world.instructor))
    assert res.status_code == 200
    assert res.json()["effectiveScore"] == 80
    assert res.json()["instructorComment"] == "Great README"  # comment kept when omitted

    res = client.put(url, json={"overrideScore": 101}, headers=world.auth(world.instructor))
    assert res.status_code == 400
    assert res.json()["code"] == "INVALID_OVERRIDE_SCORE"
    assert (
        client.put(
            url, json={"overrideScore": -1}, headers=world.auth(world.instructor)
        ).status_code
        == 422
    )

    res = client.put(url, json={"overrideScore": 100}, headers=world.auth(world.student))
    assert res.status_code == 403
    assert res.json()["code"] == "NOT_COURSE_OWNER"
    res = client.put(url, json={"overrideScore": 100}, headers=world.auth(world.other_instructor))
    assert res.status_code == 403


def test_re_review_resets_and_reruns(
    client: TestClient, world: World, fake_ai: FakeAI, factory: sessionmaker[Session]
) -> None:
    processed(world)
    url = f"/api/v1/submissions/{world.submission_id}/re-review"
    assert client.post(url, headers=world.auth(world.student)).status_code == 403

    fake_ai.scores = (20, 10)
    res = client.post(url, headers=world.auth(world.instructor))
    assert res.status_code == 202, res.text
    body = res.json()
    assert body["id"] == world.submission_id
    assert body["status"] == "pending"
    assert body["effectiveScore"] is None

    # Background task ran the pipeline after the response.
    with factory() as db:
        submission = db.get(Submission, world.submission_id)
        assert submission is not None
        assert submission.status == SubmissionStatus.completed
        assert db.scalars(select(Review)).one().total_score == 30


# ---------------------------------------------------------------------------
# Roasts
# ---------------------------------------------------------------------------


def test_roast_not_ready_and_visible(client: TestClient, world: World) -> None:
    url = f"/api/v1/submissions/{world.submission_id}/roast"
    res = client.get(url, headers=world.auth(world.student))
    assert res.status_code == 404
    assert res.json()["code"] == "ROAST_NOT_READY"

    processed(world)
    res = client.get(url, headers=world.auth(world.student))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["spiceLevel"] == "medium"
    assert body["isHidden"] is False
    assert body["isShared"] is False
    assert body["shareSlug"] is None
    assert body["regenerateCount"] == 0
    assert set(body) >= {"id", "reviewId", "content", "punchline", "createdAt", "updatedAt"}


def test_hidden_roast_404_for_student_visible_for_instructor(
    client: TestClient, world: World, factory: sessionmaker[Session]
) -> None:
    processed(world)
    rid = roast_id(factory)
    vis = f"/api/v1/roasts/{rid}/visibility"
    assert (
        client.put(vis, json={"isHidden": True}, headers=world.auth(world.student)).status_code
        == 403
    )
    res = client.put(vis, json={"isHidden": True}, headers=world.auth(world.instructor))
    assert res.status_code == 200
    assert res.json()["isHidden"] is True

    url = f"/api/v1/submissions/{world.submission_id}/roast"
    res = client.get(url, headers=world.auth(world.student))
    assert res.status_code == 404
    assert res.json()["code"] == "ROAST_NOT_READY"
    res = client.get(url, headers=world.auth(world.instructor))
    assert res.status_code == 200
    assert res.json()["isHidden"] is True

    # Hidden roasts cannot be regenerated either.
    regen = client.post(
        f"/api/v1/roasts/{rid}/regenerate", json={}, headers=world.auth(world.student)
    )
    assert regen.status_code == 404

    res = client.put(vis, json={"isHidden": False}, headers=world.auth(world.instructor))
    assert res.json()["isHidden"] is False
    assert client.get(url, headers=world.auth(world.student)).status_code == 200


def test_regenerate_limit(client: TestClient, world: World, factory: sessionmaker[Session]) -> None:
    processed(world)
    rid = roast_id(factory)
    url = f"/api/v1/roasts/{rid}/regenerate"

    assert client.post(url, json={}, headers=world.auth(world.classmate)).status_code == 403
    assert client.post(url, json={}, headers=world.auth(world.instructor)).status_code == 403

    res = client.post(url, json={"spiceLevel": "mass"}, headers=world.auth(world.student))
    assert res.status_code == 200, res.text
    assert res.json()["spiceLevel"] == "mass"
    assert res.json()["regenerateCount"] == 1
    assert res.json()["content"].endswith("Version 2.")

    res = client.post(url, headers=world.auth(world.student))  # no body: keep spice
    assert res.status_code == 200, res.text
    assert res.json()["spiceLevel"] == "mass"
    assert res.json()["regenerateCount"] == 2

    res = client.post(url, json={}, headers=world.auth(world.student))
    assert res.status_code == 409
    assert res.json()["code"] == "REGENERATE_LIMIT"


def test_regenerate_ai_unavailable_returns_503(
    client: TestClient,
    world: World,
    factory: sessionmaker[Session],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    processed(world)
    rid = roast_id(factory)

    def _boom(**_kwargs: Any) -> ai_client.AIResult:
        raise ai_client.AIServiceError("down")

    monkeypatch.setattr(ai_client, "generate_structured", _boom)
    res = client.post(
        f"/api/v1/roasts/{rid}/regenerate", json={}, headers=world.auth(world.student)
    )
    assert res.status_code == 503
    assert res.json()["code"] == "AI_UNAVAILABLE"
    with factory() as db:
        assert db.get(Roast, rid).regenerate_count == 0  # type: ignore[union-attr]
