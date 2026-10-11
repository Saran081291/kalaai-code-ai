"""Tests for ``GET /api/v1/dashboard`` (student + instructor/admin views)."""

from collections.abc import Iterator
from datetime import datetime, timedelta
from itertools import count
from pathlib import Path
from typing import Any

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
from app.models.base import utcnow
from app.routers import dashboard as dashboard_router

URL = "/api/v1/dashboard"

if not any(getattr(route, "path", None) == URL for route in app.routes):
    _api = APIRouter(prefix="/api/v1")
    _api.include_router(dashboard_router.router)
    app.include_router(_api)

_seq = count(1)


# --------------------------------------------------------------------------- #
# Fixtures + factories
# --------------------------------------------------------------------------- #


@pytest.fixture()
def db(tmp_path: Path) -> Iterator[Session]:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'dashboard.db'}", connect_args={"check_same_thread": False}
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


def make_user(db: Session, role: UserRole = UserRole.student, name: str = "User") -> User:
    n = next(_seq)
    user = User(email=f"user{n}@example.com", full_name=f"{name} {n}", role=role)
    db.add(user)
    db.commit()
    return user


def make_course(db: Session, instructor: User, name: str, *, archived: bool = False) -> Course:
    course = Course(
        instructor_id=instructor.id,
        name=name,
        join_code=f"JC{next(_seq):06d}",
        is_archived=archived,
    )
    db.add(course)
    db.commit()
    return course


def enroll(db: Session, course: Course, *students: User) -> None:
    for student in students:
        db.add(CourseEnrollment(course_id=course.id, student_id=student.id))
    db.commit()


def make_assignment(
    db: Session,
    course: Course,
    title: str,
    *,
    due_in_days: float | None = 7,
    published: bool = True,
    max_attempts: int = 3,
    allow_late: bool = False,
) -> Assignment:
    due = None if due_in_days is None else utcnow() + timedelta(days=due_in_days)
    assignment = Assignment(
        course_id=course.id,
        created_by=course.instructor_id,
        title=title,
        description="Do the thing",
        language=ProgrammingLanguage.python,
        due_date=due,
        max_attempts=max_attempts,
        allow_late=allow_late,
        is_published=published,
    )
    db.add(assignment)
    db.commit()
    return assignment


def make_submission(
    db: Session,
    assignment: Assignment,
    student: User,
    *,
    status: SubmissionStatus = SubmissionStatus.completed,
    score: int | None = None,
    override: int | None = None,
    submitted_at: datetime | None = None,
) -> Submission:
    attempt = (
        db.query(Submission).filter_by(assignment_id=assignment.id, student_id=student.id).count()
        + 1
    )
    submission = Submission(
        assignment_id=assignment.id,
        student_id=student.id,
        attempt_number=attempt,
        source_type=SourceType.github,
        github_url="https://github.com/example/repo",
        spice_level=SpiceLevel.medium,
        status=status,
        error_message="boom" if status == SubmissionStatus.failed else None,
        submitted_at=submitted_at or utcnow(),
    )
    db.add(submission)
    db.flush()
    if score is not None:
        db.add(
            Review(
                submission_id=submission.id,
                total_score=score,
                summary="ok",
                model_used="test-model",
                instructor_override_score=override,
            )
        )
    db.commit()
    return submission


def auth(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}


def get_dashboard(client: TestClient, user: User) -> dict[str, Any]:
    response = client.get(URL, headers=auth(user))
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


# --------------------------------------------------------------------------- #
# Tests
# --------------------------------------------------------------------------- #


def test_unauthenticated_returns_401(client: TestClient) -> None:
    response = client.get(URL)
    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_TOKEN"


def test_student_upcoming_filtering_and_ordering(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    student = make_user(db)
    course = make_course(db, teacher, "Python 101")
    archived = make_course(db, teacher, "Old Course", archived=True)
    other = make_course(db, teacher, "Not Enrolled")
    enroll(db, course, student)
    enroll(db, archived, student)

    late_ok = make_assignment(db, course, "Late OK", due_in_days=-2, allow_late=True)
    soon = make_assignment(db, course, "Soon", due_in_days=1)
    later = make_assignment(db, course, "Later", due_in_days=5)
    no_due_a = make_assignment(db, course, "No Due A", due_in_days=None)
    no_due_b = make_assignment(db, course, "No Due B", due_in_days=None)
    make_assignment(db, course, "No Due C (over limit)", due_in_days=None)

    done = make_assignment(db, course, "Done", due_in_days=2)
    exhausted = make_assignment(db, course, "Exhausted", due_in_days=2, max_attempts=2)
    make_assignment(db, course, "Past Due", due_in_days=-1)
    make_assignment(db, course, "Draft", due_in_days=2, published=False)
    make_assignment(db, archived, "Archived Course Work", due_in_days=2)
    make_assignment(db, other, "Other Course Work", due_in_days=2)

    make_submission(db, soon, student, status=SubmissionStatus.failed)
    make_submission(db, done, student, status=SubmissionStatus.failed)
    make_submission(db, done, student, status=SubmissionStatus.completed, score=70)
    make_submission(db, exhausted, student, status=SubmissionStatus.failed)
    make_submission(db, exhausted, student, status=SubmissionStatus.failed)

    body = get_dashboard(client, student)
    assert body["role"] == "student"
    upcoming = body["upcomingAssignments"]
    assert [a["id"] for a in upcoming] == [late_ok.id, soon.id, later.id, no_due_a.id, no_due_b.id]

    soon_row = upcoming[1]
    assert soon_row == {
        "id": soon.id,
        "title": "Soon",
        "courseId": course.id,
        "courseName": "Python 101",
        "dueDate": soon_row["dueDate"],
        "attemptsUsed": 1,
        "maxAttempts": 3,
    }
    assert soon_row["dueDate"] is not None
    assert upcoming[3]["dueDate"] is None
    assert upcoming[0]["attemptsUsed"] == 0


def test_student_recent_results_latest_five(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    student = make_user(db)
    classmate = make_user(db)
    course = make_course(db, teacher, "JS Basics")
    enroll(db, course, student, classmate)
    base = utcnow() - timedelta(days=1)

    created = []
    for i in range(7):
        assignment = make_assignment(db, course, f"A{i}")
        created.append(
            make_submission(
                db, assignment, student, score=10 * i, submitted_at=base + timedelta(minutes=i)
            )
        )
    make_submission(
        db, created[0].assignment, classmate, score=99, submitted_at=base + timedelta(hours=2)
    )

    results = get_dashboard(client, student)["recentResults"]
    assert [r["id"] for r in results] == [s.id for s in reversed(created[2:])]
    newest = results[0]
    assert newest["studentId"] == student.id
    assert newest["assignmentTitle"] == "A6"
    assert newest["courseId"] == course.id
    assert newest["courseName"] == "JS Basics"
    assert newest["effectiveScore"] == 60
    assert newest["status"] == "completed"


def test_student_ranks(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    top, me, idle = make_user(db), make_user(db), make_user(db)
    course = make_course(db, teacher, "Algorithms")
    empty = make_course(db, teacher, "Brand New")
    enroll(db, course, top, me, idle)
    enroll(db, empty, me)

    a1 = make_assignment(db, course, "Sorting")
    a2 = make_assignment(db, course, "Graphs")
    make_submission(db, a1, top, score=90)
    make_submission(db, a2, top, score=80)
    make_submission(db, a1, me, score=40, override=60)

    ranks = {r["courseId"]: r for r in get_dashboard(client, me)["ranks"]}
    assert set(ranks) == {course.id, empty.id}
    assert ranks[course.id] == {
        "courseId": course.id,
        "courseName": "Algorithms",
        "rank": 2,
        "totalStudents": 3,
        "totalScore": 60,
    }
    assert ranks[empty.id]["rank"] is None
    assert ranks[empty.id]["totalScore"] == 0
    assert ranks[empty.id]["totalStudents"] == 1

    idle_rank = next(r for r in get_dashboard(client, idle)["ranks"] if r["courseId"] == course.id)
    assert idle_rank["rank"] is None
    assert idle_rank["totalScore"] == 0
    assert get_dashboard(client, top)["ranks"][0]["rank"] == 1


def _instructor_world(db: Session) -> dict[str, Any]:
    """Two instructors, three courses (one archived), a mix of submission statuses."""
    teacher = make_user(db, UserRole.instructor)
    rival = make_user(db, UserRole.instructor)
    s1, s2 = make_user(db), make_user(db)
    main = make_course(db, teacher, "Main")
    archived = make_course(db, teacher, "Archived", archived=True)
    foreign = make_course(db, rival, "Foreign")
    enroll(db, main, s1, s2)
    enroll(db, foreign, s1)

    a_main = make_assignment(db, main, "Main 1", max_attempts=10)
    make_assignment(db, main, "Main draft", published=False)
    a_arch = make_assignment(db, archived, "Arch 1")
    a_foreign = make_assignment(db, foreign, "Foreign 1")

    base = utcnow() - timedelta(days=1)
    statuses = [
        SubmissionStatus.completed,
        SubmissionStatus.failed,
        SubmissionStatus.pending,
        SubmissionStatus.fetching,
        SubmissionStatus.reviewing,
        SubmissionStatus.roasting,
        SubmissionStatus.failed,
    ]
    main_subs = [
        make_submission(
            db,
            a_main,
            s1 if i % 2 else s2,
            status=status,
            score=50 if status == SubmissionStatus.completed else None,
            submitted_at=base + timedelta(minutes=i),
        )
        for i, status in enumerate(statuses)
    ]
    arch_subs = [
        make_submission(db, a_arch, s1, status=SubmissionStatus.failed, submitted_at=base)
        for _ in range(2)
    ] + [
        make_submission(
            db, a_arch, s2, status=SubmissionStatus.completed, submitted_at=base, score=10
        )
        for _ in range(3)
    ]
    foreign_sub = make_submission(
        db, a_foreign, s1, status=SubmissionStatus.failed, submitted_at=base + timedelta(hours=1)
    )
    return {
        "teacher": teacher,
        "main": main,
        "foreign": foreign,
        "main_subs": main_subs,
        "arch_subs": arch_subs,
        "foreign_sub": foreign_sub,
    }


def test_instructor_dashboard(client: TestClient, db: Session) -> None:
    world = _instructor_world(db)
    body = get_dashboard(client, world["teacher"])
    assert body["role"] == "instructor"
    assert set(body) == {"role", "recentSubmissions", "failedSubmissions", "courseStats"}

    owned_ids = {s.id for s in world["main_subs"] + world["arch_subs"]}
    recent = body["recentSubmissions"]
    assert len(recent) == 10
    assert {r["id"] for r in recent} <= owned_ids
    assert world["foreign_sub"].id not in {r["id"] for r in recent}
    assert recent[0]["id"] == world["main_subs"][-1].id
    assert recent[0]["studentName"] is not None
    assert recent[0]["courseName"] == "Main"

    failed = body["failedSubmissions"]
    assert all(f["status"] == "failed" for f in failed)
    expected_failed = [world["main_subs"][6].id, world["main_subs"][1].id]
    assert [f["id"] for f in failed[:2]] == expected_failed
    assert len(failed) == 4  # 2 main + 2 archived; foreign excluded

    assert body["courseStats"] == [
        {
            "courseId": world["main"].id,
            "courseName": "Main",
            "studentCount": 2,
            "assignmentCount": 2,
            "submissionCount": 7,
            "inProgressCount": 4,
        }
    ]


def test_admin_gets_instructor_view_of_everything(client: TestClient, db: Session) -> None:
    world = _instructor_world(db)
    admin = make_user(db, UserRole.admin)
    body = get_dashboard(client, admin)

    assert body["role"] == "instructor"
    assert body["recentSubmissions"][0]["id"] == world["foreign_sub"].id
    assert world["foreign_sub"].id in {f["id"] for f in body["failedSubmissions"]}
    stats = {s["courseId"]: s for s in body["courseStats"]}
    assert set(stats) == {world["main"].id, world["foreign"].id}
    assert stats[world["foreign"].id]["submissionCount"] == 1
    assert stats[world["foreign"].id]["studentCount"] == 1


def test_instructor_without_courses_gets_empty_view(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    body = get_dashboard(client, teacher)
    assert body == {
        "role": "instructor",
        "recentSubmissions": [],
        "failedSubmissions": [],
        "courseStats": [],
    }
