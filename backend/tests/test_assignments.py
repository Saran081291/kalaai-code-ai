"""Tests for the assignment + rubric endpoints."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from itertools import count
from pathlib import Path
from typing import Any

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.auth.security import create_access_token
from app.database import Base, get_db
from app.main import app
from app.models import (
    Course,
    CourseEnrollment,
    Review,
    RubricCriterion,
    SourceType,
    SpiceLevel,
    Submission,
    User,
    UserRole,
)
from app.routers import assignments as assignments_router
from app.routers import courses as courses_router

API = "/api/v1"

if not any(getattr(route, "path", None) == f"{API}/courses" for route in app.routes):
    _api = APIRouter(prefix=API)
    _api.include_router(courses_router.router)
    _api.include_router(assignments_router.router)
    app.include_router(_api)

_seq = count(1)

RUBRIC = [
    {"name": "Correctness", "description": "Works", "maxPoints": 60, "position": 0},
    {"name": "Style", "description": "Readable", "maxPoints": 40, "position": 1},
]


# --------------------------------------------------------------------------- #
# Fixtures + factories
# --------------------------------------------------------------------------- #


@pytest.fixture()
def db(tmp_path: Path) -> Iterator[Session]:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'assignments.db'}", connect_args={"check_same_thread": False}
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
def client(db: Session) -> TestClient:
    return TestClient(app)


def make_user(db: Session, role: UserRole = UserRole.student) -> User:
    n = next(_seq)
    user = User(email=f"asg-user{n}@example.com", full_name=f"User {n}", role=role)
    db.add(user)
    db.commit()
    return user


def make_course(db: Session, instructor: User, *, archived: bool = False) -> Course:
    n = next(_seq)
    course = Course(
        instructor_id=instructor.id, name=f"Course {n}", join_code=f"C{n:07d}", is_archived=archived
    )
    db.add(course)
    db.commit()
    return course


def enroll(db: Session, course: Course, student: User) -> None:
    db.add(CourseEnrollment(course_id=course.id, student_id=student.id))
    db.commit()


def make_submission(db: Session, assignment_id: int, student: User, attempt: int = 1) -> Submission:
    submission = Submission(
        assignment_id=assignment_id,
        student_id=student.id,
        attempt_number=attempt,
        source_type=SourceType.github,
        github_url="https://github.com/a/b",
        spice_level=SpiceLevel.mild,
    )
    db.add(submission)
    db.commit()
    return submission


def auth(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}


def create_assignment(
    client: TestClient, course_id: int, owner: User, **overrides: Any
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "title": "FizzBuzz",
        "description": "Write **FizzBuzz**",
        "language": "python",
    }
    payload.update(overrides)
    res = client.post(f"{API}/courses/{course_id}/assignments", json=payload, headers=auth(owner))
    assert res.status_code == 201, res.text
    return res.json()


# --------------------------------------------------------------------------- #
# Tests
# --------------------------------------------------------------------------- #


def test_create_defaults_and_shape(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    course = make_course(db, teacher)
    body = create_assignment(client, course.id, teacher, rubricCriteria=RUBRIC)

    assert body["courseId"] == course.id
    assert body["createdBy"] == teacher.id
    assert body["maxScore"] == 100
    assert body["maxAttempts"] == 3
    assert body["allowLate"] is False
    assert body["isPublished"] is False
    assert body["dueDate"] is None
    assert "myAttemptsCount" not in body
    assert [c["name"] for c in body["rubricCriteria"]] == ["Correctness", "Style"]
    assert set(body["rubricCriteria"][0]) == {
        "id",
        "assignmentId",
        "name",
        "description",
        "maxPoints",
        "position",
    }


def test_create_guards_and_validation(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    other_teacher = make_user(db, UserRole.instructor)
    student = make_user(db)
    course = make_course(db, teacher)
    enroll(db, course, student)
    url = f"{API}/courses/{course.id}/assignments"
    base = {"title": "T", "description": "D", "language": "python"}

    res = client.post(url, json=base, headers=auth(student))
    assert res.status_code == 403 and res.json()["code"] == "ROLE_REQUIRED"
    res = client.post(url, json=base, headers=auth(other_teacher))
    assert res.status_code == 403 and res.json()["code"] == "NOT_COURSE_OWNER"

    bad_payloads = [
        {**base, "language": "cobol"},
        {**base, "maxScore": 0},
        {**base, "maxScore": 1001},
        {**base, "maxAttempts": 11},
        {**base, "title": ""},
        {**base, "rubricCriteria": [{"name": "A", "description": "", "maxPoints": 0}]},
        {**base, "rubricCriteria": [RUBRIC[0], {**RUBRIC[1], "name": "correctness"}]},
    ]
    for payload in bad_payloads:
        assert client.post(url, json=payload, headers=auth(teacher)).status_code == 422, payload


def test_create_in_archived_course_rejected(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    course = make_course(db, teacher, archived=True)
    res = client.post(
        f"{API}/courses/{course.id}/assignments",
        json={"title": "T", "description": "D", "language": "python"},
        headers=auth(teacher),
    )
    assert res.status_code == 400


def test_student_cannot_see_unpublished(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    student, outsider = make_user(db), make_user(db)
    course = make_course(db, teacher)
    enroll(db, course, student)
    draft = create_assignment(client, course.id, teacher)

    res = client.get(f"{API}/courses/{course.id}/assignments", headers=auth(student))
    assert res.status_code == 200 and res.json() == []
    assert client.get(f"{API}/assignments/{draft['id']}", headers=auth(student)).status_code == 404

    res = client.get(f"{API}/courses/{course.id}/assignments", headers=auth(outsider))
    assert res.status_code == 403 and res.json()["code"] == "NOT_COURSE_MEMBER"

    owner_list = client.get(f"{API}/courses/{course.id}/assignments", headers=auth(teacher)).json()
    assert [a["id"] for a in owner_list] == [draft["id"]]


def test_publish_requires_matching_rubric(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    course = make_course(db, teacher)
    empty = create_assignment(client, course.id, teacher)
    res = client.post(f"{API}/assignments/{empty['id']}/publish", headers=auth(teacher))
    assert res.status_code == 400 and res.json()["code"] == "RUBRIC_TOTAL_MISMATCH"

    short = create_assignment(client, course.id, teacher, rubricCriteria=RUBRIC[:1])
    res = client.post(f"{API}/assignments/{short['id']}/publish", headers=auth(teacher))
    assert res.status_code == 400
    assert res.json()["code"] == "RUBRIC_TOTAL_MISMATCH"
    assert "60" in res.json()["detail"] and "100" in res.json()["detail"]

    ok = create_assignment(client, course.id, teacher, rubricCriteria=RUBRIC)
    res = client.post(f"{API}/assignments/{ok['id']}/publish", headers=auth(teacher))
    assert res.status_code == 200 and res.json()["isPublished"] is True
    # idempotent
    res = client.post(f"{API}/assignments/{ok['id']}/publish", headers=auth(teacher))
    assert res.status_code == 200 and res.json()["isPublished"] is True


def test_replace_rubric(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    course = make_course(db, teacher)
    asg = create_assignment(client, course.id, teacher, rubricCriteria=RUBRIC)
    url = f"{API}/assignments/{asg['id']}/rubric"

    new = [
        {"name": "Tests", "description": "", "maxPoints": 30, "position": 2},
        {"name": "Logic", "description": "", "maxPoints": 50, "position": 0},
        {"name": "Docs", "description": "", "maxPoints": 20, "position": 1},
    ]
    res = client.put(url, json={"criteria": new}, headers=auth(teacher))
    assert res.status_code == 200, res.text
    assert [c["name"] for c in res.json()["rubricCriteria"]] == ["Logic", "Docs", "Tests"]
    remaining = db.scalars(
        select(RubricCriterion).where(RubricCriterion.assignment_id == asg["id"])
    ).all()
    assert len(remaining) == 3

    assert client.put(url, json={"criteria": []}, headers=auth(teacher)).status_code == 422
    dupes = {"criteria": [new[0], {**new[1], "name": "TESTS"}]}
    assert client.put(url, json=dupes, headers=auth(teacher)).status_code == 422
    too_many = {
        "criteria": [
            {"name": f"C{i}", "description": "", "maxPoints": 1, "position": i} for i in range(21)
        ]
    }
    assert client.put(url, json=too_many, headers=auth(teacher)).status_code == 422

    # published: total must still equal maxScore
    assert client.post(f"{API}/assignments/{asg['id']}/publish", headers=auth(teacher)).is_success
    res = client.put(url, json={"criteria": new[:2]}, headers=auth(teacher))
    assert res.status_code == 400 and res.json()["code"] == "RUBRIC_TOTAL_MISMATCH"


def test_replace_rubric_blocked_after_reviews(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    student = make_user(db)
    course = make_course(db, teacher)
    enroll(db, course, student)
    asg = create_assignment(client, course.id, teacher, rubricCriteria=RUBRIC)
    submission = make_submission(db, asg["id"], student)
    db.add(Review(submission_id=submission.id, total_score=80, summary="ok", model_used="m"))
    db.commit()

    res = client.put(
        f"{API}/assignments/{asg['id']}/rubric", json={"criteria": RUBRIC}, headers=auth(teacher)
    )
    assert res.status_code == 409 and res.json()["code"] == "HAS_SUBMISSIONS"


def test_update_max_score_on_published(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    course = make_course(db, teacher)
    asg = create_assignment(client, course.id, teacher, rubricCriteria=RUBRIC)
    url = f"{API}/assignments/{asg['id']}"

    # draft: free to change
    res = client.put(url, json={"maxScore": 50, "title": "Renamed"}, headers=auth(teacher))
    assert res.status_code == 200
    assert res.json()["maxScore"] == 50 and res.json()["title"] == "Renamed"
    assert res.json()["description"] == asg["description"]
    client.put(url, json={"maxScore": 100}, headers=auth(teacher))
    client.post(f"{url}/publish", headers=auth(teacher))

    res = client.put(url, json={"maxScore": 90}, headers=auth(teacher))
    assert res.status_code == 400 and res.json()["code"] == "RUBRIC_TOTAL_MISMATCH"

    due = (datetime.now(UTC) + timedelta(days=3)).isoformat()
    res = client.put(url, json={"dueDate": due, "allowLate": True}, headers=auth(teacher))
    assert res.status_code == 200
    assert res.json()["dueDate"] is not None and res.json()["allowLate"] is True
    res = client.put(url, json={"dueDate": None}, headers=auth(teacher))
    assert res.json()["dueDate"] is None
    assert client.put(url, json={"title": None}, headers=auth(teacher)).status_code == 422

    other_teacher = make_user(db, UserRole.instructor)
    res = client.put(url, json={"title": "x"}, headers=auth(other_teacher))
    assert res.status_code == 403 and res.json()["code"] == "NOT_COURSE_OWNER"


def test_delete_assignment(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    student = make_user(db)
    course = make_course(db, teacher)
    enroll(db, course, student)
    free = create_assignment(client, course.id, teacher, rubricCriteria=RUBRIC)
    used = create_assignment(client, course.id, teacher, rubricCriteria=RUBRIC)
    make_submission(db, used["id"], student)

    res = client.delete(f"{API}/assignments/{used['id']}", headers=auth(teacher))
    assert res.status_code == 409 and res.json()["code"] == "HAS_SUBMISSIONS"

    res = client.delete(f"{API}/assignments/{free['id']}", headers=auth(teacher))
    assert res.status_code == 204 and res.content == b""
    assert client.get(f"{API}/assignments/{free['id']}", headers=auth(teacher)).status_code == 404
    orphans = db.scalars(
        select(RubricCriterion).where(RubricCriterion.assignment_id == free["id"])
    ).all()
    assert orphans == []


def test_my_attempts_count_and_ordering(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    student, other = make_user(db), make_user(db)
    course = make_course(db, teacher)
    enroll(db, course, student)
    enroll(db, course, other)

    now = datetime.now(UTC)
    undated = create_assignment(client, course.id, teacher, title="Undated", rubricCriteria=RUBRIC)
    later = create_assignment(
        client,
        course.id,
        teacher,
        title="Later",
        dueDate=(now + timedelta(days=5)).isoformat(),
        rubricCriteria=RUBRIC,
    )
    sooner = create_assignment(
        client,
        course.id,
        teacher,
        title="Sooner",
        dueDate=(now + timedelta(days=1)).isoformat(),
        rubricCriteria=RUBRIC,
    )
    for asg in (undated, later, sooner):
        client.post(f"{API}/assignments/{asg['id']}/publish", headers=auth(teacher))

    make_submission(db, later["id"], student, 1)
    make_submission(db, later["id"], student, 2)
    make_submission(db, later["id"], other, 1)

    res = client.get(f"{API}/courses/{course.id}/assignments", headers=auth(student))
    assert res.status_code == 200
    rows = res.json()
    assert [r["title"] for r in rows] == ["Sooner", "Later", "Undated"]
    assert {r["title"]: r["myAttemptsCount"] for r in rows} == {
        "Sooner": 0,
        "Later": 2,
        "Undated": 0,
    }
    assert all(len(r["rubricCriteria"]) == 2 for r in rows)

    detail = client.get(f"{API}/assignments/{later['id']}", headers=auth(student)).json()
    assert detail["myAttemptsCount"] == 2
    assert [c["position"] for c in detail["rubricCriteria"]] == [0, 1]

    owner_detail = client.get(f"{API}/assignments/{later['id']}", headers=auth(teacher)).json()
    assert "myAttemptsCount" not in owner_detail
    owner_rows = client.get(f"{API}/courses/{course.id}/assignments", headers=auth(teacher)).json()
    assert all("myAttemptsCount" not in r for r in owner_rows)
