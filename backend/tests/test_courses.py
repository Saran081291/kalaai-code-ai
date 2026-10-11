"""Tests for the course endpoints (CRUD/archive, join flow, regenerate code, roster)."""

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
from app.models import Course, CourseEnrollment, User, UserRole
from app.routers import assignments as assignments_router
from app.routers import courses as courses_router
from app.services.course_service import JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH

API = "/api/v1"

if not any(getattr(route, "path", None) == f"{API}/courses" for route in app.routes):
    _api = APIRouter(prefix=API)
    _api.include_router(courses_router.router)
    _api.include_router(assignments_router.router)
    app.include_router(_api)

_seq = count(1)


# --------------------------------------------------------------------------- #
# Fixtures + factories
# --------------------------------------------------------------------------- #


@pytest.fixture()
def db(tmp_path: Path) -> Iterator[Session]:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'courses.db'}", connect_args={"check_same_thread": False}
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
    user = User(email=f"course-user{n}@example.com", full_name=f"{name} {n}", role=role)
    db.add(user)
    db.commit()
    return user


def auth(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}


def create_course(client: TestClient, instructor: User, name: str = "Python 101") -> dict:
    res = client.post(
        f"{API}/courses", json={"name": name, "description": "Intro"}, headers=auth(instructor)
    )
    assert res.status_code == 201, res.text
    return res.json()


# --------------------------------------------------------------------------- #
# Tests
# --------------------------------------------------------------------------- #


def test_create_course_shape_and_join_code(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    body = create_course(client, teacher)

    assert set(body) == {
        "id",
        "instructorId",
        "name",
        "description",
        "joinCode",
        "isArchived",
        "isInstructor",
        "studentCount",
        "createdAt",
        "updatedAt",
    }
    assert body["instructorId"] == teacher.id
    assert body["isInstructor"] is True
    assert body["isArchived"] is False
    assert body["studentCount"] == 0
    code = body["joinCode"]
    assert len(code) == JOIN_CODE_LENGTH
    assert all(ch in JOIN_CODE_ALPHABET for ch in code)
    assert not set(code) & set("0O1I")


def test_create_course_requires_instructor_and_auth(client: TestClient, db: Session) -> None:
    student = make_user(db)
    res = client.post(f"{API}/courses", json={"name": "Nope"}, headers=auth(student))
    assert res.status_code == 403
    assert res.json()["code"] == "ROLE_REQUIRED"

    assert client.post(f"{API}/courses", json={"name": "Nope"}).status_code == 401


def test_create_course_validation(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    for payload in ({"name": ""}, {"name": "   "}, {"name": "x" * 201}):
        res = client.post(f"{API}/courses", json=payload, headers=auth(teacher))
        assert res.status_code == 422, payload
    res = client.post(
        f"{API}/courses",
        json={"name": "ok", "description": "d" * 2001},
        headers=auth(teacher),
    )
    assert res.status_code == 422


def test_admin_can_create_course(client: TestClient, db: Session) -> None:
    admin = make_user(db, UserRole.admin)
    assert create_course(client, admin)["isInstructor"] is True


def test_join_flow_and_errors(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    student = make_user(db)
    course = create_course(client, teacher)

    # case-insensitive + stripped
    res = client.post(
        f"{API}/courses/join",
        json={"joinCode": f"  {course['joinCode'].lower()} "},
        headers=auth(student),
    )
    assert res.status_code == 200, res.text
    joined = res.json()
    assert joined["id"] == course["id"]
    assert joined["isInstructor"] is False
    assert joined["studentCount"] == 1

    again = client.post(
        f"{API}/courses/join", json={"joinCode": course["joinCode"]}, headers=auth(student)
    )
    assert again.status_code == 409
    assert again.json()["code"] == "ALREADY_ENROLLED"

    bad = client.post(f"{API}/courses/join", json={"joinCode": "ZZZZZZZZ"}, headers=auth(student))
    assert bad.status_code == 404
    assert bad.json()["code"] == "INVALID_JOIN_CODE"

    # instructors cannot join as students (role guard)
    other_teacher = make_user(db, UserRole.instructor)
    res = client.post(
        f"{API}/courses/join", json={"joinCode": course["joinCode"]}, headers=auth(other_teacher)
    )
    assert res.status_code == 403
    assert res.json()["code"] == "ROLE_REQUIRED"


def test_owner_joining_own_course_conflicts(client: TestClient, db: Session) -> None:
    admin = make_user(db, UserRole.admin)
    course = create_course(client, admin)
    res = client.post(
        f"{API}/courses/join", json={"joinCode": course["joinCode"]}, headers=auth(admin)
    )
    assert res.status_code == 409


def test_join_archived_course_is_invalid(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    student = make_user(db)
    course = create_course(client, teacher)
    assert client.delete(f"{API}/courses/{course['id']}", headers=auth(teacher)).status_code == 204

    res = client.post(
        f"{API}/courses/join", json={"joinCode": course["joinCode"]}, headers=auth(student)
    )
    assert res.status_code == 404
    assert res.json()["code"] == "INVALID_JOIN_CODE"


def test_list_courses_scoping_order_and_student_count(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    other_teacher = make_user(db, UserRole.instructor)
    s1, s2 = make_user(db), make_user(db)
    first = create_course(client, teacher, "First")
    second = create_course(client, teacher, "Second")
    foreign = create_course(client, other_teacher, "Foreign")
    archived = create_course(client, teacher, "Archived")

    for student in (s1, s2):
        db.add(CourseEnrollment(course_id=first["id"], student_id=student.id))
    db.add(CourseEnrollment(course_id=archived["id"], student_id=s1.id))
    db.commit()
    client.delete(f"{API}/courses/{archived['id']}", headers=auth(teacher))

    res = client.get(f"{API}/courses", headers=auth(teacher))
    assert res.status_code == 200
    data = res.json()
    assert [c["id"] for c in data] == [second["id"], first["id"]]  # newest first, no archived
    counts = {c["id"]: c["studentCount"] for c in data}
    assert counts == {first["id"]: 2, second["id"]: 0}

    student_view = client.get(f"{API}/courses", headers=auth(s1)).json()
    assert [c["id"] for c in student_view] == [first["id"]]
    assert student_view[0]["isInstructor"] is False

    admin = make_user(db, UserRole.admin)
    admin_ids = {c["id"] for c in client.get(f"{API}/courses", headers=auth(admin)).json()}
    assert admin_ids == {first["id"], second["id"], foreign["id"]}


def test_get_course_membership(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    member, outsider = make_user(db), make_user(db)
    course = create_course(client, teacher)
    db.add(CourseEnrollment(course_id=course["id"], student_id=member.id))
    db.commit()

    assert client.get(f"{API}/courses/{course['id']}", headers=auth(member)).status_code == 200
    res = client.get(f"{API}/courses/{course['id']}", headers=auth(outsider))
    assert res.status_code == 403
    assert res.json()["code"] == "NOT_COURSE_MEMBER"
    assert client.get(f"{API}/courses/99999", headers=auth(teacher)).status_code == 404


def test_update_archive_regenerate_owner_only(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    other_teacher = make_user(db, UserRole.instructor)
    course = create_course(client, teacher)
    cid = course["id"]

    res = client.put(f"{API}/courses/{cid}", json={"name": "Hacked"}, headers=auth(other_teacher))
    assert res.status_code == 403
    assert res.json()["code"] == "NOT_COURSE_OWNER"

    res = client.put(
        f"{API}/courses/{cid}",
        json={"name": " Renamed ", "description": None},
        headers=auth(teacher),
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Renamed"
    assert res.json()["description"] is None

    # partial: name only keeps description
    client.put(f"{API}/courses/{cid}", json={"description": "New desc"}, headers=auth(teacher))
    res = client.put(f"{API}/courses/{cid}", json={"name": "Again"}, headers=auth(teacher))
    assert res.json()["description"] == "New desc"
    assert (
        client.put(f"{API}/courses/{cid}", json={"name": None}, headers=auth(teacher)).status_code
        == 422
    )

    res = client.post(f"{API}/courses/{cid}/regenerate-code", headers=auth(teacher))
    assert res.status_code == 200
    assert res.json()["joinCode"] != course["joinCode"]
    assert (
        client.post(f"{API}/courses/{cid}/regenerate-code", headers=auth(other_teacher)).status_code
        == 403
    )

    assert client.delete(f"{API}/courses/{cid}", headers=auth(other_teacher)).status_code == 403
    res = client.delete(f"{API}/courses/{cid}", headers=auth(teacher))
    assert res.status_code == 204
    assert res.content == b""
    db.expire_all()
    stored = db.get(Course, cid)
    assert stored is not None and stored.is_archived is True

    # owner can still GET an archived course
    res = client.get(f"{API}/courses/{cid}", headers=auth(teacher))
    assert res.status_code == 200
    assert res.json()["isArchived"] is True


def test_students_roster(client: TestClient, db: Session) -> None:
    teacher = make_user(db, UserRole.instructor)
    zed = make_user(db, name="zed")
    amy = make_user(db, name="Amy")
    course = create_course(client, teacher)
    for student in (zed, amy):
        db.add(CourseEnrollment(course_id=course["id"], student_id=student.id))
    db.commit()

    res = client.get(f"{API}/courses/{course['id']}/students", headers=auth(teacher))
    assert res.status_code == 200
    rows = res.json()
    assert [r["id"] for r in rows] == [amy.id, zed.id]
    assert set(rows[0]) == {"id", "email", "fullName", "avatarUrl", "joinedAt"}

    res = client.get(f"{API}/courses/{course['id']}/students", headers=auth(amy))
    assert res.status_code == 403
