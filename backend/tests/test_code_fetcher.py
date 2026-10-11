"""Tests for ``app.services.code_fetcher`` (no network: GitHub is an httpx.MockTransport)."""

import io
import stat
import tarfile
import zipfile
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest

from app.config import settings
from app.exceptions import BadRequestError
from app.services import code_fetcher
from app.services.code_fetcher import (
    CodeFetchError,
    collect_uploaded_files,
    fetch_github_repo,
    submission_upload_dir,
    validate_github_url,
)

SHA = "0123456789abcdef0123456789abcdef01234567"


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def make_zip(entries: dict[str, bytes], *, compression: int = zipfile.ZIP_DEFLATED) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=compression) as archive:
        for name, data in entries.items():
            archive.writestr(zipfile.ZipInfo(name), data, compress_type=compression)
    return buffer.getvalue()


def make_tarball(
    entries: dict[str, bytes], *, symlinks: dict[str, str] | None = None, prefix: str = ""
) -> bytes:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        for name, data in entries.items():
            info = tarfile.TarInfo(prefix + name)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
        for name, target in (symlinks or {}).items():
            info = tarfile.TarInfo(prefix + name)
            info.type = tarfile.SYMTYPE
            info.linkname = target
            tar.addfile(info)
    return buffer.getvalue()


def write_upload_dir(tmp_path: Path, files: dict[str, bytes]) -> Path:
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    for name, data in files.items():
        (upload_dir / name).write_bytes(data)
    return upload_dir


def github_client(
    tarball: bytes,
    *,
    repo_status: int = 200,
    repo_headers: dict[str, str] | None = None,
    seen: list[httpx.Request] | None = None,
) -> httpx.Client:
    def handler(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(request)
        path = request.url.path
        if request.url.host == "codeload.github.com":
            return httpx.Response(200, content=tarball)
        if path == "/repos/octo/hello":
            if repo_status != 200:
                return httpx.Response(
                    repo_status, json={"message": "nope"}, headers=repo_headers or {}
                )
            return httpx.Response(200, json={"default_branch": "main"})
        if path == "/repos/octo/hello/commits/main":
            return httpx.Response(200, json={"sha": SHA})
        if path == f"/repos/octo/hello/tarball/{SHA}":
            return httpx.Response(
                302, headers={"Location": f"https://codeload.github.com/octo/hello/tar.gz/{SHA}"}
            )
        return httpx.Response(404)

    return httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=True)


# --------------------------------------------------------------------------- #
# URL validation
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://github.com/octo/hello", "https://github.com/octo/hello"),
        ("https://github.com/octo/hello/", "https://github.com/octo/hello"),
        ("https://github.com/octo/hello.git", "https://github.com/octo/hello"),
        ("  https://github.com/octo/my.repo-2  ", "https://github.com/octo/my.repo-2"),
        ("https://github.com/octo/hello/tree/dev/src", "https://github.com/octo/hello"),
    ],
)
def test_validate_github_url_accepts(url: str, expected: str) -> None:
    assert validate_github_url(url) == expected


@pytest.mark.parametrize(
    "url",
    [
        "http://github.com/octo/hello",
        "https://gitlab.com/octo/hello",
        "https://github.com/octo",
        "https://github.com/octo/hello/blob/main/a.py",
        "https://github.com/octo/hello?x=1",
        "https://github.com/../hello",
        "https://evil.com/https://github.com/octo/hello",
        "",
    ],
)
def test_validate_github_url_rejects(url: str) -> None:
    with pytest.raises(BadRequestError) as exc:
        validate_github_url(url)
    assert exc.value.code == "INVALID_GITHUB_URL"


def test_submission_upload_dir(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    assert submission_upload_dir(7) == tmp_path / "submissions" / "7"


# --------------------------------------------------------------------------- #
# Uploaded files / zips
# --------------------------------------------------------------------------- #


def test_collect_loose_files_filters(tmp_path: Path) -> None:
    upload_dir = write_upload_dir(
        tmp_path,
        {
            "main.py": b"print('vanakkam')\n",
            "App.TSX": b"export const App = () => null;\n",
            "package-lock.json": b"{}",
            "notes.txt": b"not code",
            "blob.py": b"\x00\x01binary",
            "huge.js": b"a" * (200 * 1024 + 1),
            "bad.py": b"x = '\xff\xfe'\n",
        },
    )
    result = collect_uploaded_files(upload_dir)
    assert result.commit_sha is None
    assert [f.path for f in result.files] == ["App.TSX", "bad.py", "main.py"]
    by_path = {f.path: f for f in result.files}
    assert by_path["main.py"].language == "python"
    assert by_path["App.TSX"].language == "typescript"
    assert "\ufffd" in by_path["bad.py"].content
    assert by_path["main.py"].size_bytes == len(b"print('vanakkam')\n")


def test_collect_zip(tmp_path: Path) -> None:
    data = make_zip(
        {
            "proj/": b"",
            "proj/src/app.py": b"def main():\n    return 1\n",
            "proj/README.md": b"# hi",
            "proj/node_modules/lib/index.js": b"module.exports = 1",
            "proj/.venv/x.py": b"x = 1",
            "proj/dist/bundle.min.js": b"var a;",
            "proj/poetry.lock": b"lock",
            "proj/logo.png": b"\x89PNG",
        }
    )
    upload_dir = write_upload_dir(tmp_path, {"code.zip": data})
    result = collect_uploaded_files(upload_dir)
    assert [f.path for f in result.files] == ["proj/README.md", "proj/src/app.py"]


@pytest.mark.parametrize("name", ["../evil.py", "a/../../evil.py", "/etc/evil.py", "C:/evil.py"])
def test_zip_slip_rejected(tmp_path: Path, name: str) -> None:
    upload_dir = write_upload_dir(tmp_path, {"code.zip": make_zip({"ok.py": b"x=1", name: b"y"})})
    with pytest.raises(CodeFetchError) as exc:
        collect_uploaded_files(upload_dir)
    assert exc.value.code == "UNSAFE_ARCHIVE"
    assert not (tmp_path / "evil.py").exists()


def test_zip_symlink_rejected(tmp_path: Path) -> None:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("ok.py", "x = 1")
        link = zipfile.ZipInfo("link.py")
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        archive.writestr(link, "/etc/passwd")
    upload_dir = write_upload_dir(tmp_path, {"code.zip": buffer.getvalue()})
    with pytest.raises(CodeFetchError) as exc:
        collect_uploaded_files(upload_dir)
    assert exc.value.code == "UNSAFE_ARCHIVE"


def test_zip_bomb_ratio_rejected(tmp_path: Path) -> None:
    upload_dir = write_upload_dir(
        tmp_path, {"code.zip": make_zip({"bomb.py": b"\x20" * (4 * 1024 * 1024)})}
    )
    with pytest.raises(CodeFetchError) as exc:
        collect_uploaded_files(upload_dir)
    assert exc.value.code == "ZIP_BOMB"


def test_zip_total_uncompressed_cap(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 1)  # cap = 10 MB uncompressed
    entries = {f"f{i}.py": b"\x20" * (3 * 1024 * 1024) for i in range(4)}
    upload_dir = write_upload_dir(
        tmp_path, {"code.zip": make_zip(entries, compression=zipfile.ZIP_DEFLATED)}
    )
    with pytest.raises(CodeFetchError) as exc:
        collect_uploaded_files(upload_dir)
    assert exc.value.code == "ARCHIVE_TOO_LARGE"


def test_zip_entry_count_cap(tmp_path: Path) -> None:
    entries = {f"f{i}.py": b"x" for i in range(code_fetcher.MAX_ZIP_ENTRIES + 1)}
    upload_dir = write_upload_dir(tmp_path, {"code.zip": make_zip(entries)})
    with pytest.raises(CodeFetchError) as exc:
        collect_uploaded_files(upload_dir)
    assert exc.value.code == "ARCHIVE_TOO_MANY_ENTRIES"


def test_corrupt_zip(tmp_path: Path) -> None:
    upload_dir = write_upload_dir(tmp_path, {"code.zip": b"PK\x03\x04garbage"})
    with pytest.raises(CodeFetchError) as exc:
        collect_uploaded_files(upload_dir)
    assert exc.value.code == "INVALID_ARCHIVE"


def test_no_code_files(tmp_path: Path) -> None:
    upload_dir = write_upload_dir(tmp_path, {"code.zip": make_zip({"a.png": b"\x89PNG"})})
    with pytest.raises(CodeFetchError) as exc:
        collect_uploaded_files(upload_dir)
    assert exc.value.code == "NO_CODE_FILES"
    assert exc.value.message == "Code-ey illaye thambi! No code files found."


def test_missing_upload_dir(tmp_path: Path) -> None:
    with pytest.raises(CodeFetchError) as exc:
        collect_uploaded_files(tmp_path / "missing")
    assert exc.value.code == "UPLOAD_MISSING"


def test_file_count_cap_keeps_first_sorted(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setattr(settings, "MAX_UPLOAD_FILES", 3)
    upload_dir = write_upload_dir(tmp_path, {f"f{i}.py": b"x = 1" for i in range(6)})
    result = collect_uploaded_files(upload_dir)
    assert [f.path for f in result.files] == ["f0.py", "f1.py", "f2.py"]


# --------------------------------------------------------------------------- #
# GitHub
# --------------------------------------------------------------------------- #


def _repo_tarball() -> bytes:
    return make_tarball(
        {
            "app.py": b"print('hi')\n",
            "src/util.ts": b"export const x = 1;\n",
            "node_modules/dep/index.js": b"module.exports = {};",
            "package-lock.json": b"{}",
            "image.py": b"\x00\x00\x00",
            "big.py": b"#" * (200 * 1024 + 10),
        },
        symlinks={"link.py": "/etc/passwd"},
        prefix=f"octo-hello-{SHA[:7]}/",
    )


def test_fetch_github_repo_success(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "GITHUB_TOKEN", "test-token")
    seen: list[httpx.Request] = []
    with github_client(_repo_tarball(), seen=seen) as client:
        result = fetch_github_repo("https://github.com/octo/hello.git", client=client)
    assert result.commit_sha == SHA
    assert [f.path for f in result.files] == ["app.py", "src/util.ts"]
    api_requests = [r for r in seen if r.url.host == "api.github.com"]
    assert api_requests
    for request in api_requests:
        assert request.headers["Accept"] == "application/vnd.github+json"
        assert request.headers["Authorization"] == "Bearer test-token"
    # Token must not leak to the cross-origin redirect target.
    codeload = [r for r in seen if r.url.host == "codeload.github.com"]
    assert codeload and "Authorization" not in codeload[0].headers


def test_fetch_github_not_found() -> None:
    with github_client(b"", repo_status=404) as client, pytest.raises(CodeFetchError) as exc:
        fetch_github_repo("https://github.com/octo/hello", client=client)
    assert exc.value.code == "GITHUB_NOT_FOUND"
    assert exc.value.message == "Repo-ve kaanom thambi! Public-a irukka check pannu."


def test_fetch_github_rate_limited() -> None:
    client = github_client(b"", repo_status=403, repo_headers={"x-ratelimit-remaining": "0"})
    with client, pytest.raises(CodeFetchError) as exc:
        fetch_github_repo("https://github.com/octo/hello", client=client)
    assert exc.value.code == "GITHUB_RATE_LIMIT"


def test_fetch_github_too_large(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 1)
    blob = bytes(range(256)) * (5 * 1024)  # 1.25 MB
    with github_client(blob) as client, pytest.raises(CodeFetchError) as exc:
        fetch_github_repo("https://github.com/octo/hello", client=client)
    assert exc.value.code == "REPO_TOO_LARGE"


def test_fetch_github_gzip_bomb(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 1)  # 10 MB decompressed cap
    tarball = make_tarball({"zeros.py": b"\x00" * (12 * 1024 * 1024)}, prefix="o-r-1/")
    assert len(tarball) < 1024 * 1024
    with github_client(tarball) as client, pytest.raises(CodeFetchError) as exc:
        fetch_github_repo("https://github.com/octo/hello", client=client)
    assert exc.value.code == "REPO_TOO_LARGE"


def test_fetch_github_traversal_rejected() -> None:
    tarball = make_tarball({"o-r-1/ok.py": b"x", "../../evil.py": b"y"})
    with github_client(tarball) as client, pytest.raises(CodeFetchError) as exc:
        fetch_github_repo("https://github.com/octo/hello", client=client)
    assert exc.value.code == "UNSAFE_ARCHIVE"


def test_fetch_github_timeout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("slow", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with client, pytest.raises(CodeFetchError) as exc:
        fetch_github_repo("https://github.com/octo/hello", client=client)
    assert exc.value.code == "GITHUB_TIMEOUT"


def test_fetch_github_invalid_url() -> None:
    never: Callable[[httpx.Request], httpx.Response] = lambda r: httpx.Response(500)  # noqa: E731
    client = httpx.Client(transport=httpx.MockTransport(never))
    with client, pytest.raises(CodeFetchError) as exc:
        fetch_github_repo("https://example.com/x/y", client=client)
    assert exc.value.code == "INVALID_GITHUB_URL"
