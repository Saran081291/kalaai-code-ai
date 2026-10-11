"""Secure ingestion of student code from GitHub repos or uploaded files.

Security rules (student code is untrusted data):
- Student code is NEVER executed or imported; it is only read as text.
- Archives are never extracted to disk: members are read in memory after their
  paths are validated (no absolute paths, no ``..``, no links/devices).
- Every read is capped (download size, decompressed size, entry count, per-file
  size, total file count) to defeat zip/gzip bombs.
"""

import gzip
import io
import logging
import re
import stat
import tarfile
import zipfile
import zlib
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from urllib.parse import quote

import httpx

from app.config import settings
from app.exceptions import BadRequestError

logger = logging.getLogger(__name__)

# --- Filtering rules ---------------------------------------------------------

#: Allowed source extensions -> language label stored on ``SubmissionFile.language``.
LANGUAGE_BY_EXTENSION: dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".java": "java",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".go": "go",
    ".rb": "ruby",
    ".php": "php",
    ".html": "html",
    ".css": "css",
    ".sql": "sql",
    ".md": "markdown",
    ".json": "json",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".toml": "toml",
}
ALLOWED_EXTENSIONS: frozenset[str] = frozenset(LANGUAGE_BY_EXTENSION)
ZIP_EXTENSION = ".zip"

SKIP_DIRS: frozenset[str] = frozenset(
    {
        "node_modules",
        ".git",
        "venv",
        ".venv",
        "__pycache__",
        "dist",
        "build",
        ".next",
        "coverage",
        "target",
    }
)
LOCK_FILES: frozenset[str] = frozenset(
    {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "pipfile.lock"}
)

MAX_FILE_BYTES = 200 * 1024
BINARY_SNIFF_BYTES = 8 * 1024
MAX_ZIP_ENTRIES = 500
MAX_TAR_ENTRIES = 5000
MAX_COMPRESSION_RATIO = 100
BOMB_RATIO_MIN_BYTES = 1024 * 1024
UNCOMPRESSED_MULTIPLIER = 10

GITHUB_API_URL = "https://api.github.com"
GITHUB_TIMEOUT_SECONDS = 30.0
_DOWNLOAD_CHUNK = 64 * 1024

_GITHUB_URL_RE = re.compile(
    r"^https://github\.com/"
    r"(?P<owner>[A-Za-z0-9_.-]+)/"
    r"(?P<repo>[A-Za-z0-9_.-]+?)"
    r"(?:\.git)?"
    r"(?:/tree/[^\s?#]+)?"
    r"/?$"
)
_WINDOWS_DRIVE_RE = re.compile(r"^[A-Za-z]:")

NO_CODE_FILES_MESSAGE = "Code-ey illaye thambi! No code files found."


# --- Public types ------------------------------------------------------------


class CodeFetchError(Exception):
    """Code could not be fetched/collected. ``message`` is user-facing, ``code`` is machine."""

    def __init__(self, message: str, code: str = "CODE_FETCH_ERROR") -> None:
        self.message = message
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class CollectedFile:
    """One accepted source file (decoded as UTF-8 text)."""

    path: str
    language: str | None
    size_bytes: int
    content: str


@dataclass(frozen=True)
class FetchResult:
    """All collected files plus the commit SHA (GitHub only)."""

    files: list[CollectedFile]
    commit_sha: str | None


# --- Limits ------------------------------------------------------------------


def _max_upload_bytes() -> int:
    return settings.MAX_UPLOAD_MB * 1024 * 1024


def _max_uncompressed_bytes() -> int:
    return _max_upload_bytes() * UNCOMPRESSED_MULTIPLIER


def submission_upload_dir(submission_id: int) -> Path:
    """Directory holding the raw uploads of one submission."""
    return Path(settings.UPLOAD_DIR) / "submissions" / str(submission_id)


# --- Path + content filtering --------------------------------------------------


def _safe_relpath(name: str) -> str:
    """Normalise an archive member name to a relative POSIX path.

    Raises:
        CodeFetchError: ``UNSAFE_ARCHIVE`` for absolute paths or ``..`` traversal.
    """
    normalised = name.replace("\\", "/")
    if normalised.startswith("/") or _WINDOWS_DRIVE_RE.match(normalised):
        raise CodeFetchError(
            "Archive-la unsafe path irukku thambi! (absolute path)", code="UNSAFE_ARCHIVE"
        )
    parts = [p for p in normalised.split("/") if p not in ("", ".")]
    if any(p == ".." for p in parts):
        raise CodeFetchError(
            "Archive-la unsafe path irukku thambi! ('..' not allowed)", code="UNSAFE_ARCHIVE"
        )
    return "/".join(parts)


def language_for_path(path: str) -> str | None:
    """Return the language label for an allowed file path, else ``None``."""
    return LANGUAGE_BY_EXTENSION.get(PurePosixPath(path).suffix.lower())


def is_allowed_path(path: str) -> bool:
    """True if a relative path passes the dir/lock-file/extension filters."""
    parts = path.split("/")
    if not parts or not parts[-1]:
        return False
    if any(part in SKIP_DIRS for part in parts[:-1]):
        return False
    filename = parts[-1].lower()
    if filename in LOCK_FILES or filename.endswith(".min.js"):
        return False
    return language_for_path(path) is not None


def _decode_file(path: str, data: bytes) -> CollectedFile | None:
    """Turn raw bytes into a ``CollectedFile``; ``None`` for oversized/binary content."""
    if len(data) > MAX_FILE_BYTES:
        logger.info("Skipping %s: larger than %d bytes", path, MAX_FILE_BYTES)
        return None
    if b"\x00" in data[:BINARY_SNIFF_BYTES]:
        logger.info("Skipping %s: looks binary", path)
        return None
    return CollectedFile(
        path=path,
        language=language_for_path(path),
        size_bytes=len(data),
        content=data.decode("utf-8", errors="replace"),
    )


def _finalize(files: list[CollectedFile], commit_sha: str | None) -> FetchResult:
    """De-duplicate, sort, cap to ``MAX_UPLOAD_FILES`` and reject empty results."""
    unique: dict[str, CollectedFile] = {}
    for item in files:
        unique.setdefault(item.path, item)
    ordered = [unique[path] for path in sorted(unique)]
    if not ordered:
        raise CodeFetchError(NO_CODE_FILES_MESSAGE, code="NO_CODE_FILES")
    limit = settings.MAX_UPLOAD_FILES
    if len(ordered) > limit:
        dropped = [f.path for f in ordered[limit:]]
        logger.warning(
            "Keeping first %d of %d code files; dropped: %s", limit, len(ordered), dropped
        )
        ordered = ordered[:limit]
    return FetchResult(files=ordered, commit_sha=commit_sha)


# --- Zip handling --------------------------------------------------------------


def _is_zip_symlink(info: zipfile.ZipInfo) -> bool:
    mode = info.external_attr >> 16
    return stat.S_ISLNK(mode)


def _read_zip(zip_path: Path) -> list[CollectedFile]:
    """Read allowed members of an uploaded zip into memory (never extracts to disk)."""
    max_total = _max_uncompressed_bytes()
    try:
        with zipfile.ZipFile(zip_path) as archive:
            infos = archive.infolist()
            if len(infos) > MAX_ZIP_ENTRIES:
                raise CodeFetchError(
                    f"Zip-la romba files thambi (max {MAX_ZIP_ENTRIES} entries). "
                    "node_modules / venv-a remove panni re-zip pannu.",
                    code="ARCHIVE_TOO_MANY_ENTRIES",
                )
            declared_total = sum(info.file_size for info in infos)
            if declared_total > max_total:
                raise CodeFetchError(
                    "Zip extract panna romba perusa irukku thambi! Archive too large.",
                    code="ARCHIVE_TOO_LARGE",
                )
            collected: list[CollectedFile] = []
            read_total = 0
            for info in infos:
                path = _safe_relpath(info.filename)
                if _is_zip_symlink(info):
                    raise CodeFetchError(
                        "Zip-la symlink irukku thambi! Symlinks are not allowed.",
                        code="UNSAFE_ARCHIVE",
                    )
                ratio = info.file_size / max(info.compress_size, 1)
                if info.file_size >= BOMB_RATIO_MIN_BYTES and ratio > MAX_COMPRESSION_RATIO:
                    raise CodeFetchError(
                        "Zip bomb maadhiri irukku thambi! Suspicious compression ratio.",
                        code="ZIP_BOMB",
                    )
                if info.is_dir() or not path or not is_allowed_path(path):
                    continue
                if info.flag_bits & 0x1:
                    logger.info("Skipping encrypted zip member %s", path)
                    continue
                if info.file_size > MAX_FILE_BYTES:
                    logger.info("Skipping %s: larger than %d bytes", path, MAX_FILE_BYTES)
                    continue
                with archive.open(info) as member:
                    data = member.read(MAX_FILE_BYTES + 1)
                read_total += len(data)
                if read_total > max_total:
                    raise CodeFetchError(
                        "Zip extract panna romba perusa irukku thambi! Archive too large.",
                        code="ARCHIVE_TOO_LARGE",
                    )
                decoded = _decode_file(path, data)
                if decoded is not None:
                    collected.append(decoded)
            return collected
    except (zipfile.BadZipFile, zlib.error, EOFError, NotImplementedError) as exc:
        logger.info("Invalid zip upload %s: %s", zip_path.name, exc)
        raise CodeFetchError(
            "Zip file corrupt-a irukku thambi! Please upload a valid .zip.",
            code="INVALID_ARCHIVE",
        ) from exc


def collect_uploaded_files(upload_dir: Path) -> FetchResult:
    """Collect code from a submission's saved uploads (loose code files and/or one .zip).

    Raises:
        CodeFetchError: missing uploads, unsafe/invalid archive, or no code files.
    """
    if not upload_dir.is_dir():
        raise CodeFetchError(
            "Uploaded files kaanom thambi! Please submit again.", code="UPLOAD_MISSING"
        )
    collected: list[CollectedFile] = []
    for entry in sorted(upload_dir.iterdir(), key=lambda p: p.name):
        if entry.is_symlink() or not entry.is_file():
            logger.warning("Ignoring non-regular upload entry %s", entry.name)
            continue
        name = entry.name
        if name.lower().endswith(ZIP_EXTENSION):
            collected.extend(_read_zip(entry))
            continue
        if not is_allowed_path(name):
            logger.info("Skipping upload %s: not an allowed code file", name)
            continue
        with entry.open("rb") as handle:
            data = handle.read(MAX_FILE_BYTES + 1)
        decoded = _decode_file(name, data)
        if decoded is not None:
            collected.append(decoded)
    return _finalize(collected, commit_sha=None)


# --- GitHub --------------------------------------------------------------------


def _parse_github_url(url: str) -> tuple[str, str]:
    """Return ``(owner, repo)`` or raise ``BadRequestError(INVALID_GITHUB_URL)``."""
    candidate = url.strip()
    match = _GITHUB_URL_RE.match(candidate) if len(candidate) <= 500 else None
    if match is None:
        raise BadRequestError(
            "Invalid GitHub URL. Use https://github.com/<owner>/<repo>",
            code="INVALID_GITHUB_URL",
        )
    owner, repo = match.group("owner"), match.group("repo")
    if owner in (".", "..") or repo in (".", "..") or not repo:
        raise BadRequestError(
            "Invalid GitHub URL. Use https://github.com/<owner>/<repo>",
            code="INVALID_GITHUB_URL",
        )
    return owner, repo


def validate_github_url(url: str) -> str:
    """Return the normalised ``https://github.com/<owner>/<repo>`` URL.

    Raises:
        BadRequestError: ``INVALID_GITHUB_URL`` for anything else.
    """
    owner, repo = _parse_github_url(url)
    return f"https://github.com/{owner}/{repo}"


def _github_headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "kalaai-code",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if settings.GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"
    return headers


def _raise_for_github_status(response: httpx.Response) -> None:
    """Map non-2xx GitHub API responses onto ``CodeFetchError``."""
    status_code = response.status_code
    if status_code < 400:
        return
    if status_code == 404:
        raise CodeFetchError(
            "Repo-ve kaanom thambi! Public-a irukka check pannu.", code="GITHUB_NOT_FOUND"
        )
    if status_code in (403, 429):
        raise CodeFetchError(
            "GitHub rate limit hit aayiduchu thambi! Konjam neram kazhichu retry pannu.",
            code="GITHUB_RATE_LIMIT",
        )
    logger.warning("GitHub API error %s for %s", status_code, response.request.url)
    raise CodeFetchError(
        f"GitHub-la problem thambi (HTTP {status_code}). Retry pannu.", code="GITHUB_ERROR"
    )


def _get_json(client: httpx.Client, path: str) -> dict[str, object]:
    response = client.get(f"{GITHUB_API_URL}{path}")
    _raise_for_github_status(response)
    try:
        payload = response.json()
    except ValueError as exc:
        raise CodeFetchError(
            "GitHub response puriyala thambi. Retry pannu.", code="GITHUB_ERROR"
        ) from exc
    if not isinstance(payload, dict):
        raise CodeFetchError("GitHub response puriyala thambi. Retry pannu.", code="GITHUB_ERROR")
    return payload


def _repo_too_large() -> CodeFetchError:
    return CodeFetchError(
        f"Repo romba perusa irukku thambi! Max {settings.MAX_UPLOAD_MB} MB.",
        code="REPO_TOO_LARGE",
    )


def _download_tarball(client: httpx.Client, owner: str, repo: str, ref: str) -> bytes:
    """Stream the repo tarball into memory, aborting once the size cap is exceeded."""
    cap = _max_upload_bytes()
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/tarball/{quote(ref, safe='')}"
    with client.stream("GET", url) as response:
        _raise_for_github_status(response)
        declared = response.headers.get("Content-Length")
        if declared is not None and declared.isdigit() and int(declared) > cap:
            raise _repo_too_large()
        buffer = bytearray()
        for chunk in response.iter_bytes(_DOWNLOAD_CHUNK):
            buffer.extend(chunk)
            if len(buffer) > cap:
                raise _repo_too_large()
    return bytes(buffer)


class _CappedReader(io.RawIOBase):
    """Read-only stream wrapper that raises once more than ``limit`` bytes are read."""

    def __init__(self, raw: io.BufferedIOBase, limit: int) -> None:
        super().__init__()
        self._raw = raw
        self._limit = limit
        self._total = 0

    def readable(self) -> bool:
        return True

    def readinto(self, buffer: memoryview | bytearray) -> int:  # type: ignore[override]
        data = self._raw.read(len(buffer))
        size = len(data)
        buffer[:size] = data
        self._total += size
        if self._total > self._limit:
            raise _repo_too_large()
        return size


def _iter_tar_members(tar: tarfile.TarFile) -> Iterator[tarfile.TarInfo]:
    for count, member in enumerate(tar, start=1):
        if count > MAX_TAR_ENTRIES:
            raise CodeFetchError(
                f"Repo-la romba files thambi (max {MAX_TAR_ENTRIES} entries).",
                code="REPO_TOO_LARGE",
            )
        yield member


def _read_tarball(data: bytes) -> list[CollectedFile]:
    """Read allowed files from a GitHub tar.gz in memory (top-level folder stripped)."""
    collected: list[CollectedFile] = []
    try:
        with gzip.GzipFile(fileobj=io.BytesIO(data)) as gz:
            capped = io.BufferedReader(_CappedReader(gz, _max_uncompressed_bytes()))
            with tarfile.open(fileobj=capped, mode="r|") as tar:
                for member in _iter_tar_members(tar):
                    relpath = _safe_relpath(member.name)
                    if member.issym() or member.islnk():
                        logger.info("Skipping link in repo tarball: %s", relpath)
                        continue
                    if not member.isfile():
                        continue
                    parts = relpath.split("/", 1)
                    if len(parts) < 2:
                        continue
                    path = parts[1]
                    if not is_allowed_path(path):
                        continue
                    if member.size > MAX_FILE_BYTES:
                        logger.info("Skipping %s: larger than %d bytes", path, MAX_FILE_BYTES)
                        continue
                    handle = tar.extractfile(member)
                    if handle is None:
                        continue
                    decoded = _decode_file(path, handle.read(MAX_FILE_BYTES + 1))
                    if decoded is not None:
                        collected.append(decoded)
    except (tarfile.TarError, OSError, EOFError, zlib.error) as exc:
        logger.info("Invalid GitHub tarball: %s", exc)
        raise CodeFetchError(
            "GitHub archive corrupt-a irukku thambi. Retry pannu.", code="INVALID_ARCHIVE"
        ) from exc
    return collected


def fetch_github_repo(url: str, *, client: httpx.Client | None = None) -> FetchResult:
    """Download a public repo's default branch (HEAD) and collect its code files.

    Args:
        url: GitHub repo URL (validated with :func:`validate_github_url`).
        client: Optional pre-configured ``httpx.Client`` (tests inject a MockTransport).

    Raises:
        CodeFetchError: not found, rate limited, too large, invalid archive, no code files.
    """
    try:
        owner, repo = _parse_github_url(url)
    except BadRequestError as exc:
        raise CodeFetchError(exc.detail, code="INVALID_GITHUB_URL") from exc

    own_client = client is None
    http = client or httpx.Client(timeout=GITHUB_TIMEOUT_SECONDS, follow_redirects=True)
    http.headers.update(_github_headers())
    try:
        repo_info = _get_json(http, f"/repos/{owner}/{repo}")
        branch = repo_info.get("default_branch")
        if not isinstance(branch, str) or not branch:
            raise CodeFetchError("Repo default branch kaanom thambi.", code="GITHUB_ERROR")
        commit = _get_json(http, f"/repos/{owner}/{repo}/commits/{quote(branch, safe='')}")
        sha = commit.get("sha")
        if not isinstance(sha, str) or not re.fullmatch(r"[0-9a-fA-F]{7,64}", sha):
            raise CodeFetchError("Repo commit kaanom thambi.", code="GITHUB_ERROR")
        tarball = _download_tarball(http, owner, repo, sha)
    except httpx.TimeoutException as exc:
        raise CodeFetchError(
            "GitHub romba slow-a irukku thambi. Retry pannu.", code="GITHUB_TIMEOUT"
        ) from exc
    except httpx.HTTPError as exc:
        logger.warning("GitHub request failed for %s/%s: %s", owner, repo, exc)
        raise CodeFetchError(
            "GitHub-a reach panna mudiyala thambi. Retry pannu.", code="GITHUB_ERROR"
        ) from exc
    finally:
        if own_client:
            http.close()

    files = _read_tarball(tarball)
    logger.info("Fetched %s/%s@%s: %d candidate files", owner, repo, sha[:12], len(files))
    return _finalize(files, commit_sha=sha)


__all__ = [
    "ALLOWED_EXTENSIONS",
    "LANGUAGE_BY_EXTENSION",
    "ZIP_EXTENSION",
    "CodeFetchError",
    "CollectedFile",
    "FetchResult",
    "collect_uploaded_files",
    "fetch_github_repo",
    "is_allowed_path",
    "language_for_path",
    "submission_upload_dir",
    "validate_github_url",
]
