"""Tests for the submissions API (``app.routers.submissions``)."""

import io
import sys
import types
import zipfile
from collections.abc import Iterator
from datetime import timedelta
from itertools import count
from pathlib import Path

import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.auth.security import create_access_token
from app.config import settings
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
    SubmissionFile,
    SubmissionStatus,
    User,
    UserRole,
)
from app.models.base import utcnow
from app.rate_limit import limiter
from app.routers import submissions as submissions_router
from app.services.code_fetcher import submission_upload_dir

if not any(getattr(r, "path", None) == "/api/v1/submissions/me" for r in app.routes):
    _api = APIRouter(prefix="/api/v1")
    _api.include_router(submissions_router.router)
    app.include_router(_api)

_seq = count(1)
GITHUB_URL = "https://github.com/octo/hello"


# --------------------------------------------------------------------------- #
# Fixtures + factories
# --------------------------------------------------------------------------- #


@pytest.fixture()
def db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Session]:
    engine = create_engine(
        f"sqlite:///{tmp_path / 'submissions.db'}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def _override_get_db() -> Iterator[Session]:
        session = factory()
        try:
            yield session
        finally:
            session.close()

    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path / "uploads"))
    monkeypatch.setattr(limiter, "enabled", False)
    app.dependency_overrides[get_db] = _override_get_db
    session = factory()
    try:
        yield session
    finally:
        session.close()
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


@pytest.fixture()
def queued(monkeypatch: pytest.MonkeyPatch) -> list[int]:
    """Replace ``app.services.pipeline`` with a fake whose ``run_pipeline`` records ids."""
    calls: list[int] = []
    fake = types.ModuleType("app.services.pipeline")

    def run_pipeline(submission_id: int) -> None:
        calls.append(submission_id)

    fake.run_pipeline = run_pipeline  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "app.services.pipeline", fake)
    return calls


@pytest.fixture()
def client(db: Session, queued: list[int]) -> TestClient:
    return TestClient(app)


def make_user(db: Session, role: UserRole = UserRole.student) -> User:
    n = next(_seq)
    user = User(email=f"sub{n}@example.com", full_name=f"User {n}", role=role)
    db.add(user)
    db.commit()
    return user


def auth(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id, user.role)}"}


def make_assignment(
    db: Session,
    *,
    instructor: User | None = None,
    students: tuple[User, ...] = (),
    due_in_days: float | None = 7,
    published: bool = True,
    max_attempts: int = 3,
    allow_late: bool = False,
    archived: bool = False,
) -> Assignment:
    instructor = instructor or make_user(db, UserRole.instructor)
    course = Course(
        instructor_id=instructor.id,
        name=f"Course {next(_seq)}",
        join_code=f"S{next(_seq):07d}",
        is_archived=archived,
    )
    db.add(course)
    db.flush()
    for student in students:
        db.add(CourseEnrollment(course_id=course.id, student_id=student.id))
    assignment = Assignment(
        course_id=course.id,
        created_by=instructor.id,
        title="FizzBuzz",
        description="Write fizzbuzz",
        language=ProgrammingLanguage.python,
        due_date=None if due_in_days is None else utcnow() + timedelta(days=due_in_days),
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
    attempt: int = 1,
    status: SubmissionStatus = SubmissionStatus.completed,
    refunded: bool = False,
) -> Submission:
    submission = Submission(
        assignment_id=assignment.id,
        student_id=student.id,
        attempt_number=attempt,
        source_type=SourceType.github,
        github_url=GITHUB_URL,
        spice_level=SpiceLevel.mild,
        status=status,
        error_message="boom" if status == SubmissionStatus.failed else None,
        attempt_refunded=refunded,
    )
    db.add(submission)
    db.commit()
    return submission


def submit_url(assignment: Assignment) -> str:
    return f"/api/v1/assignments/{assignment.id}/submissions"


def zip_bytes(entries: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in entries.items():
            archive.writestr(zipfile.ZipInfo(name), data)
    return buffer.getvalue()


# --------------------------------------------------------------------------- #
# Create
# --------------------------------------------------------------------------- #


def test_github_submit_202_and_queued(client: TestClient, db: Session, queued: list[int]) -> None:
    student = make_user(db)
    assignment = make_assignment(db, students=(student,))
    res = client.post(
        submit_url(assignment),
        data={"spiceLevel": "mass", "githubUrl": "https://github.com/octo/hello.git/"},
        headers=auth(student),
    )
    assert res.status_code == 202, res.text
    body = res.json()
    assert body["githubUrl"] == GITHUB_URL
    assert body["sourceType"] == "github"
    assert body["spiceLevel"] == "mass"
    assert body["status"] == "pending"
    assert body["attemptNumber"] == 1
    assert body["isLate"] is False
    assert body["createdAt"] == body["submittedAt"]
    assert body["assignmentTitle"] == "FizzBuzz"
    assert body["studentName"] == student.full_name
    assert body["effectiveScore"] is None
    assert body["maxScore"] == 100
    assert body["courseId"] == assignment.course_id
    assert queued == [body["id"]]


def test_invalid_github_url(client: TestClient, db: Session, queued: list[int]) -> None:
    student = make_user(db)
    assignment = make_assignment(db, students=(student,))
    res = client.post(
        submit_url(assignment),
        data={"spiceLevel": "mild", "githubUrl": "https://gitlab.com/a/b"},
        headers=auth(student),
    )
    assert res.status_code == 400
    assert res.json()["code"] == "INVALID_GITHUB_URL"
    assert queued == []


def test_upload_code_files(client: TestClient, db: Session, queued: list[int]) -> None:
    student = make_user(db)
    assignment = make_assignment(db, students=(student,))
    res = client.post(
        submit_url(assignment),
        data={"spiceLevel": "medium"},
        files=[
            ("files", ("main.py", b"print('hi')\n", "text/x-python")),
            ("files", ("../../utils.js", b"export {}\n", "text/javascript")),
        ],
        headers=auth(student),
    )
    assert res.status_code == 202, res.text
    body = res.json()
    assert body["sourceType"] == "upload"
    assert body["githubUrl"] is None
    saved = sorted(p.name for p in submission_upload_dir(body["id"]).iterdir())
    assert saved == ["main.py", "utils.js"]  # basename only
    assert queued == [body["id"]]


def test_upload_zip(client: TestClient, db: Session) -> None:
    student = make_user(db)
    assignment = make_assignment(db, students=(student,))
    data = zip_bytes({"proj/app.py": b"x = 1\n", "proj/node_modules/a.js": b"1"})
    res = client.post(
        submit_url(assignment),
        data={"spiceLevel": "mild"},
        files=[("files", ("proj.zip", data, "application/zip"))],
        headers=auth(student),
    )
    assert res.status_code == 202, res.text
    assert (submission_upload_dir(res.json()["id"]) / "proj.zip").read_bytes() == data


def test_zip_slip_upload_rejected_without_using_attempt(
    client: TestClient, db: Session, queued: list[int]
) -> None:
    student = make_user(db)
    assignment = make_assignment(db, students=(student,))
    res = client.post(
        submit_url(assignment),
        data={"spiceLevel": "mild"},
        files=[("files", ("evil.zip", zip_bytes({"../evil.py": b"x"}), "application/zip"))],
        headers=auth(student),
    )
    assert res.status_code == 400
    assert res.json()["code"] == "UNSAFE_ARCHIVE"
    assert db.scalars(select(Submission)).all() == []
    assert queued == []
    submissions_root = Path(settings.UPLOAD_DIR) / "submissions"
    assert not submissions_root.exists() or not any(submissions_root.iterdir())


def test_upload_too_large_413(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 1)
    student = make_user(db)
    assignment = make_assignment(db, students=(student,))
    half = b"x" * (600 * 1024)
    res = client.post(
        submit_url(assignment),
        data={"spiceLevel": "mild"},
        files=[("files", ("a.py", half, "text/plain")), ("files", ("b.py", half, "text/plain"))],
        headers=auth(student),
    )
    assert res.status_code == 413
    assert res.json()["code"] == "UPLOAD_TOO_LARGE"


def test_too_many_files_413(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "MAX_UPLOAD_FILES", 2)
    student = make_user(db)
    assignment = make_assignment(db, students=(student,))
    res = client.post(
        submit_url(assignment),
        data={"spiceLevel": "mild"},
        files=[("files", (f"f{i}.py", b"x=1", "text/plain")) for i in range(3)],
        headers=auth(student),
    )
    assert res.status_code == 413
    assert res.json()["code"] == "TOO_MANY_FILES"


@pytest.mark.parametrize(
    ("files", "code"),
    [
        ([("files", ("evil.exe", b"MZ", "application/octet-stream"))], "UNSUPPORTED_FILE"),
        ([("files", ("fake.zip", b"not a zip", "application/zip"))], "UNSUPPORTED_FILE"),
        (
            [
                ("files", ("a.zip", b"PK\x05\x06" + b"\x00" * 18, "application/zip")),
                ("files", ("b.zip", b"PK\x05\x06" + b"\x00" * 18, "application/zip")),
            ],
            "BAD_REQUEST",
        ),
        (
            [
                ("files", ("a.zip", b"PK\x05\x06" + b"\x00" * 18, "application/zip")),
                ("files", ("main.py", b"x=1", "text/plain")),
            ],
            "BAD_REQUEST",
        ),
    ],
)
def test_bad_upload_combinations(
    client: TestClient, db: Session, files: list[tuple[str, tuple[str, bytes, str]]], code: str
) -> None:
    student = make_user(db)
    assignment = make_assignment(db, students=(student,))
    res = client.post(
        submit_url(assignment), data={"spiceLevel": "mild"}, files=files, headers=auth(student)
    )
    assert res.status_code == 400
    assert res.json()["code"] == code


def test_both_or_neither_source_400(client: TestClient, db: Session) -> None:
    student = make_user(db)
    assignment = make_assignment(db, students=(student,))
    neither = client.post(
        submit_url(assignment), data={"spiceLevel": "mild"}, headers=auth(student)
    )
    assert neither.status_code == 400
    both = client.post(
        submit_url(assignment),
        data={"spiceLevel": "mild", "githubUrl": GITHUB_URL},
        files=[("files", ("a.py", b"x=1", "text/plain"))],
        headers=auth(student),
    )
    assert both.status_code == 400
    assert both.json()["code"] == "BAD_REQUEST"


def test_attempt_limit_409(client: TestClient, db: Session) -> None:
    student = make_user(db)
    assignment = make_assignment(db, students=(student,), max_attempts=2)
    payload = {"spiceLevel": "mild", "githubUrl": GITHUB_URL}
    first = client.post(submit_url(assignment), data=payload, headers=auth(student))
    second = client.post(submit_url(assignment), data=payload, headers=auth(student))
    assert [first.json()["attemptNumber"], second.json()["attemptNumber"]] == [1, 2]
    third = client.post(submit_url(assignment), data=payload, headers=auth(student))
    assert third.status_code == 409
    assert third.json()["code"] == "ATTEMPT_LIMIT"


def test_refunded_attempt_does_not_count_toward_limit(client: TestClient, db: Session) -> None:
    student = make_user(db)
    assignment = make_assignment(db, students=(student,), max_attempts=2)
    make_submission(
        db, assignment, student, attempt=1, status=SubmissionStatus.failed, refunded=True
    )
    payload = {"spiceLevel": "mild", "githubUrl": GITHUB_URL}

    first = client.post(submit_url(assignment), data=payload, headers=auth(student))
    second = client.post(submit_url(assignment), data=payload, headers=auth(student))
    assert [first.status_code, second.status_code] == [202, 202]
    assert [first.json()["attemptNumber"], second.json()["attemptNumber"]] == [2, 3]
    third = client.post(submit_url(assignment), data=payload, headers=auth(student))
    assert third.status_code == 409
    assert third.json()["code"] == "ATTEMPT_LIMIT"


def test_my_attempts_count_excludes_refunded(client: TestClient, db: Session) -> None:
    student = make_user(db)
    assignment = make_assignment(db, students=(student,), max_attempts=3)
    make_submission(
        db, assignment, student, attempt=1, status=SubmissionStatus.failed, refunded=True
    )
    make_submission(db, assignment, student, attempt=2)

    res = client.get(f"/api/v1/assignments/{assignment.id}", headers=auth(student))
    assert res.status_code == 200, res.text
    assert res.json()["myAttemptsCount"] == 1


def test_past_due_409_vs_allow_late(client: TestClient, db: Session) -> None:
    student = make_user(db)
    payload = {"spiceLevel": "mild", "githubUrl": GITHUB_URL}
    closed = make_assignment(db, students=(student,), due_in_days=-1)
    res = client.post(submit_url(closed), data=payload, headers=auth(student))
    assert res.status_code == 409
    assert res.json()["code"] == "PAST_DUE"

    late_ok = make_assignment(db, students=(student,), due_in_days=-1, allow_late=True)
    res = client.post(submit_url(late_ok), data=payload, headers=auth(student))
    assert res.status_code == 202
    assert res.json()["isLate"] is True


def test_not_enrolled_403(client: TestClient, db: Session) -> None:
    student = make_user(db)
    assignment = make_assignment(db)
    res = client.post(
        submit_url(assignment),
        data={"spiceLevel": "mild", "githubUrl": GITHUB_URL},
        headers=auth(student),
    )
    assert res.status_code == 403
    assert res.json()["code"] == "NOT_COURSE_MEMBER"


def test_unpublished_404_and_archived_409(client: TestClient, db: Session) -> None:
    student = make_user(db)
    payload = {"spiceLevel": "mild", "githubUrl": GITHUB_URL}
    draft = make_assignment(db, students=(student,), published=False)
    assert client.post(submit_url(draft), data=payload, headers=auth(student)).status_code == 404
    archived = make_assignment(db, students=(student,), archived=True)
    res = client.post(submit_url(archived), data=payload, headers=auth(student))
    assert res.status_code == 409
    assert res.json()["code"] == "COURSE_ARCHIVED"


def test_instructor_cannot_submit(client: TestClient, db: Session) -> None:
    instructor = make_user(db, UserRole.instructor)
    assignment = make_assignment(db, instructor=instructor)
    res = client.post(
        submit_url(assignment),
        data={"spiceLevel": "mild", "githubUrl": GITHUB_URL},
        headers=auth(instructor),
    )
    assert res.status_code == 403
    assert res.json()["code"] == "ROLE_REQUIRED"


# --------------------------------------------------------------------------- #
# Read
# --------------------------------------------------------------------------- #


def test_student_cannot_see_others_submission(client: TestClient, db: Session) -> None:
    alice, bob = make_user(db), make_user(db)
    assignment = make_assignment(db, students=(alice, bob))
    submission = make_submission(db, assignment, alice)
    assert (
        client.get(f"/api/v1/submissions/{submission.id}", headers=auth(alice)).status_code == 200
    )
    res = client.get(f"/api/v1/submissions/{submission.id}", headers=auth(bob))
    assert res.status_code == 403
    files = client.get(f"/api/v1/submissions/{submission.id}/files", headers=auth(bob))
    assert files.status_code == 403
    assert client.get("/api/v1/submissions/99999", headers=auth(alice)).status_code == 404


def test_instructor_list_pagination(client: TestClient, db: Session) -> None:
    instructor = make_user(db, UserRole.instructor)
    students = tuple(make_user(db) for _ in range(3))
    assignment = make_assignment(db, instructor=instructor, students=students)
    for student in students:
        make_submission(db, assignment, student, attempt=1)
        make_submission(db, assignment, student, attempt=2)
    scored = make_submission(db, assignment, students[0], attempt=3)
    db.add(
        Review(
            submission_id=scored.id,
            total_score=70,
            instructor_override_score=88,
            summary="ok",
            model_used="test",
        )
    )
    db.commit()

    url = f"{submit_url(assignment)}?page=1&pageSize=4"
    page1 = client.get(url, headers=auth(instructor)).json()
    assert page1["total"] == 7
    assert page1["page"] == 1 and page1["pageSize"] == 4
    assert len(page1["items"]) == 4
    assert page1["items"][0]["id"] == scored.id  # newest first
    assert page1["items"][0]["effectiveScore"] == 88
    assert page1["items"][0]["studentName"] == students[0].full_name
    page2 = client.get(f"{submit_url(assignment)}?page=2&pageSize=4", headers=auth(instructor))
    assert len(page2.json()["items"]) == 3
    ids = {i["id"] for i in page1["items"]} | {i["id"] for i in page2.json()["items"]}
    assert len(ids) == 7

    # A student sees only their own attempts.
    own = client.get(submit_url(assignment), headers=auth(students[1])).json()
    assert own["total"] == 2
    assert {i["studentId"] for i in own["items"]} == {students[1].id}


def test_my_submissions_across_courses(client: TestClient, db: Session) -> None:
    student = make_user(db)
    a1 = make_assignment(db, students=(student,))
    a2 = make_assignment(db, students=(student,))
    s1 = make_submission(db, a1, student)
    s2 = make_submission(db, a2, student)
    make_submission(db, a2, make_user(db))
    res = client.get("/api/v1/submissions/me", headers=auth(student))
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 2
    assert [i["id"] for i in body["items"]] == [s2.id, s1.id]
    assert {i["courseName"] for i in body["items"]} == {a1.course.name, a2.course.name}


def test_files_ordered_by_path(client: TestClient, db: Session) -> None:
    student = make_user(db)
    assignment = make_assignment(db, students=(student,))
    submission = make_submission(db, assignment, student)
    for path in ("src/z.py", "README.md", "src/a.py"):
        db.add(
            SubmissionFile(
                submission_id=submission.id,
                path=path,
                language="python",
                size_bytes=3,
                content="x=1",
            )
        )
    db.commit()
    res = client.get(f"/api/v1/submissions/{submission.id}/files", headers=auth(student))
    assert res.status_code == 200
    assert [f["path"] for f in res.json()] == ["README.md", "src/a.py", "src/z.py"]
    assert set(res.json()[0]) == {
        "id",
        "submissionId",
        "path",
        "language",
        "sizeBytes",
        "content",
        "createdAt",
    }


# --------------------------------------------------------------------------- #
# Retry
# --------------------------------------------------------------------------- #


def test_retry_only_when_failed(client: TestClient, db: Session, queued: list[int]) -> None:
    instructor = make_user(db, UserRole.instructor)
    student, other = make_user(db), make_user(db)
    assignment = make_assignment(db, instructor=instructor, students=(student, other))
    done = make_submission(db, assignment, student, attempt=1)
    failed = make_submission(db, assignment, student, attempt=2, status=SubmissionStatus.failed)

    res = client.post(f"/api/v1/submissions/{done.id}/retry", headers=auth(student))
    assert res.status_code == 409
    assert res.json()["code"] == "NOT_RETRYABLE"

    res = client.post(f"/api/v1/submissions/{failed.id}/retry", headers=auth(other))
    assert res.status_code == 403

    res = client.post(f"/api/v1/submissions/{failed.id}/retry", headers=auth(instructor))
    assert res.status_code == 202
    assert res.json()["status"] == "pending"
    assert res.json()["errorMessage"] is None
    assert queued == [failed.id]

    again = client.post(f"/api/v1/submissions/{failed.id}/retry", headers=auth(student))
    assert again.status_code == 409


def test_retry_of_refunded_submission_takes_attempt_back(
    client: TestClient, db: Session, queued: list[int]
) -> None:
    student = make_user(db)
    assignment = make_assignment(db, students=(student,), max_attempts=2)
    failed = make_submission(
        db, assignment, student, attempt=1, status=SubmissionStatus.failed, refunded=True
    )

    res = client.post(f"/api/v1/submissions/{failed.id}/retry", headers=auth(student))
    assert res.status_code == 202, res.text
    db.refresh(failed)
    assert failed.attempt_refunded is False
    assert queued == [failed.id]


def test_retry_of_refunded_submission_blocked_when_no_attempt_left(
    client: TestClient, db: Session, queued: list[int]
) -> None:
    student = make_user(db)
    assignment = make_assignment(db, students=(student,), max_attempts=2)
    failed = make_submission(
        db, assignment, student, attempt=1, status=SubmissionStatus.failed, refunded=True
    )
    make_submission(db, assignment, student, attempt=2)
    make_submission(db, assignment, student, attempt=3)

    res = client.post(f"/api/v1/submissions/{failed.id}/retry", headers=auth(student))
    assert res.status_code == 409
    assert res.json()["code"] == "ATTEMPT_LIMIT"
    db.refresh(failed)
    assert failed.attempt_refunded is True
    assert queued == []


def test_submit_rate_limited(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(limiter, "enabled", True)
    limiter.reset()
    try:
        student = make_user(db)
        assignment = make_assignment(db, students=(student,), max_attempts=50)
        payload = {"spiceLevel": "mild", "githubUrl": GITHUB_URL}
        codes = [
            client.post(submit_url(assignment), data=payload, headers=auth(student)).status_code
            for _ in range(11)
        ]
        assert codes[:10] == [202] * 10
        assert codes[10] == 429
    finally:
        limiter.reset()
