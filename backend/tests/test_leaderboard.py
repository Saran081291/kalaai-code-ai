"""Tests for ``GET /courses/{id}/leaderboard`` and ``compute_leaderboard``."""

from collections.abc import Iterator
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
    SourceType,
    SpiceLevel,
    Submission,
    SubmissionStatus,
    User,
    UserRole,
)
from app.routers import public as public_router
from app.routers import wall as wall_router
from app.services.leaderboard_service import compute_leaderboard

API = "/api/v1"

if not any(
    getattr(r, "path", None) == f"{API}/courses/{{course_id}}/leaderboard" for r in app.routes
):
    _api = APIRouter(prefix=API)
    _api.include_router(wall_router.router)
    _api.include_router(public_router.router)
    app.include_router(_api)

_seq = count(1)


@pytest.fixture()
def db(tmp_path: Path) -> Iterator[Session]:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'leaderboard.db'}", connect_args={"check_same_thread": False}
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
    user = User(email=f"lb{n}@example.com", full_name=name, role=role)
    db.add(user)
    db.commit()
    return user


def auth(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}


def make_course(db: Session, instructor: User, students: list[User]) -> Course:
    n = next(_seq)
    course = Course(instructor_id=instructor.id, name=f"Course {n}", join_code=f"LB{n:06d}")
    db.add(course)
    db.flush()
    for student in students:
        db.add(CourseEnrollment(course_id=course.id, student_id=student.id))
    db.commit()
    return course


def make_assignment(db: Session, course: Course) -> Assignment:
    assignment = Assignment(
        course_id=course.id,
        created_by=course.instructor_id,
        title=f"Assignment {next(_seq)}",
        description="Do it",
        language=ProgrammingLanguage.python,
        max_score=100,
        is_published=True,
    )
    db.add(assignment)
    db.commit()
    return assignment


_attempts: dict[tuple[int, int], int] = {}


def attempt(
    db: Session,
    assignment: Assignment,
    student: User,
    score: int | None,
    override: int | None = None,
) -> Submission:
    """Create a submission; ``score=None`` means no review (e.g. failed/pending)."""
    key = (assignment.id, student.id)
    _attempts[key] = _attempts.get(key, 0) + 1
    submission = Submission(
        assignment_id=assignment.id,
        student_id=student.id,
        attempt_number=_attempts[key],
        source_type=SourceType.upload,
        spice_level=SpiceLevel.mild,
        status=SubmissionStatus.completed if score is not None else SubmissionStatus.failed,
    )
    db.add(submission)
    db.flush()
    if score is not None:
        db.add(
            Review(
                submission_id=submission.id,
                total_score=score,
                instructor_override_score=override,
                summary="ok",
                model_used="test-model",
            )
        )
    db.commit()
    return submission


def test_leaderboard_best_attempt_override_ties_and_zero(client: TestClient, db: Session) -> None:
    instructor = make_user(db, "Prof", UserRole.instructor)
    anbu = make_user(db, "Anbu")
    bala = make_user(db, "Bala")
    chitra = make_user(db, "Chitra")
    deepa = make_user(db, "Deepa")  # enrolled, never reviewed
    outsider = make_user(db, "Zed")
    course = make_course(db, instructor, [anbu, bala, chitra, deepa])
    a1 = make_assignment(db, course)
    a2 = make_assignment(db, course)

    # Anbu: a1 best of (50, 80) = 80; a2 = 40 overridden to 70 -> 150, 2 completed.
    attempt(db, a1, anbu, 50)
    attempt(db, a1, anbu, 80)
    attempt(db, a2, anbu, 40, override=70)
    # Bala: a1 attempt 90 overridden DOWN to 60, second attempt 75 -> best 75;
    # a2 75 -> 150 (ties with Anbu), plus an unreviewed attempt that must not count.
    attempt(db, a1, bala, 90, override=60)
    attempt(db, a1, bala, 75)
    attempt(db, a2, bala, 75)
    attempt(db, a2, bala, None)
    # Chitra: only a1 = 100.
    attempt(db, a1, chitra, 100)
    # Deepa: only an unreviewed attempt.
    attempt(db, a2, deepa, None)
    # Another course's scores must not leak in.
    other = make_course(db, instructor, [anbu, outsider])
    attempt(db, make_assignment(db, other), anbu, 100)

    res = client.get(f"{API}/courses/{course.id}/leaderboard", headers=auth(chitra))
    assert res.status_code == 200, res.text
    rows = res.json()
    assert [
        (r["rank"], r["studentName"], r["totalScore"], r["assignmentsCompleted"]) for r in rows
    ] == [
        (1, "Anbu", 150, 2),
        (1, "Bala", 150, 2),
        (3, "Chitra", 100, 1),
        (4, "Deepa", 0, 0),
    ]
    assert rows[0]["studentId"] == anbu.id
    assert set(rows[0]) == {
        "rank",
        "studentId",
        "studentName",
        "avatarUrl",
        "totalScore",
        "assignmentsCompleted",
    }

    # Service is reusable directly (dashboard ranks).
    entries = compute_leaderboard(db, course.id)
    assert [(e.rank, e.student_id) for e in entries] == [
        (1, anbu.id),
        (1, bala.id),
        (3, chitra.id),
        (4, deepa.id),
    ]


def test_leaderboard_access(client: TestClient, db: Session) -> None:
    instructor = make_user(db, "Prof", UserRole.instructor)
    student = make_user(db, "Student")
    outsider = make_user(db, "Outsider")
    admin = make_user(db, "Admin", UserRole.admin)
    course = make_course(db, instructor, [student])
    url = f"{API}/courses/{course.id}/leaderboard"

    assert client.get(url).status_code == 401
    res = client.get(url, headers=auth(outsider))
    assert res.status_code == 403
    assert res.json()["code"] == "NOT_COURSE_MEMBER"
    for member in (instructor, student, admin):
        res = client.get(url, headers=auth(member))
        assert res.status_code == 200
    assert res.json() == [
        {
            "rank": 1,
            "studentId": student.id,
            "studentName": "Student",
            "avatarUrl": None,
            "totalScore": 0,
            "assignmentsCompleted": 0,
        }
    ]
    assert client.get(f"{API}/courses/999999/leaderboard", headers=auth(admin)).status_code == 404


def test_leaderboard_empty_course(db: Session) -> None:
    instructor = make_user(db, "Prof", UserRole.instructor)
    course = make_course(db, instructor, [])
    assert compute_leaderboard(db, course.id) == []
