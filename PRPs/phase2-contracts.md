# Phase 2 Contracts — Kalaai Code

> Read this before writing any Phase 2 code. It is the single source of truth shared by
> 6 backend + 6 frontend agents running in parallel. If something here conflicts with the PRP, THIS wins.

ROOT: `C:\19985\Saran Backup 2025\Automation\Social_Eagle_GenAI\Microsaas_Test Project`

---

## 1. Environment

- Backend venv: `backend/.venv/Scripts/python.exe` (Python 3.11). Run tools as `.venv/Scripts/python.exe -m ruff|mypy|pytest` from `backend/`.
- Docker is NOT running, no PostgreSQL. Validate against SQLite: `DATABASE_URL=sqlite:///<tmp>.db` (models/migrations are SQLite-compatible).
- Frontend: `frontend/` — `npm run type-check`, `npm run lint`, `npm test`, `npm run build`. Packages are installed; do NOT add dependencies unless essential (tell the orchestrator in your report if you did).
- Never git commit. Never create `.env` files.

## 2. API contract = frontend types + service files (ALREADY WRITTEN — do not change signatures)

- Types: `frontend/src/types/*.ts` (barrel `@/types`). JSON is camelCase.
- Services (endpoint → response type): `frontend/src/services/{authService,courseService,assignmentService,submissionService,reviewService,roastService,dashboardService}.ts`.
- **Backend agents: read the types + your module's service file first and make response JSON match them field-for-field** (use `CamelModel` from `app.schemas`, which aliases snake_case → camelCase).
- Frontend agents: use these services; do not edit them or `src/types/*`. If you find a genuine contract bug, work around it minimally and REPORT it.

### Key shape rules
- Lists that are **paginated** (`Page<T>` = `{items,total,page,pageSize}`, query `?page&pageSize`): `GET /assignments/{id}/submissions`, `GET /submissions/me`, `GET /courses/{id}/roast-wall`.
- Lists returned as **plain arrays**: `GET /courses`, `GET /courses/{id}/assignments`, `GET /courses/{id}/students`, `GET /courses/{id}/leaderboard`, `GET /submissions/{id}/files`.
- `Submission.createdAt` = `submitted_at` (model has no created_at). List endpoints populate denormalised `studentName, assignmentTitle, courseId, courseName, effectiveScore (null if no review), maxScore`.
- `Course.isInstructor` = current user owns it. `Course.studentCount` = enrollment count.
- `Assignment.rubricCriteria` always included on single-assignment responses (GET/PUT/publish/rubric/create); `myAttemptsCount` included for students on `GET /assignments/{id}`.
- `Review.effectiveScore` = `instructor_override_score ?? total_score`; `Review.maxScore` = assignment max_score; `criterionScores[].criterionName/maxPoints` joined from the criterion.
- `DELETE` endpoints return **204** no body. Submission create / retry / re-review return **202** with the Submission.
- Multipart submit fields: `spiceLevel` (required), `githubUrl` XOR `files` (repeated). Use `Form(alias=...)`/`File(alias="files")`.
- Errors: raise `app.exceptions` subclasses with a machine `code`, e.g. `ConflictError("Attempt limit reached", code="ATTEMPT_LIMIT")`. Codes used by the UI: `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `INVALID_JOIN_CODE`, `ALREADY_ENROLLED`, `RUBRIC_TOTAL_MISMATCH`, `HAS_SUBMISSIONS`, `NOT_PUBLISHED`, `ATTEMPT_LIMIT`, `PAST_DUE`, `INVALID_GITHUB_URL`, `UPLOAD_TOO_LARGE`(413), `TOO_MANY_FILES`(413), `UNSUPPORTED_FILE`, `NOT_RETRYABLE`, `REVIEW_NOT_READY`(404), `ROAST_NOT_READY`(404), `REGENERATE_LIMIT`, `NOT_COURSE_MEMBER`(403), `NOT_COURSE_OWNER`(403), `ROLE_REQUIRED`(403).

## 3. Backend shared core (ALREADY WRITTEN — import, don't modify)

- `app.config.settings` (UPPERCASE fields), `app.database` (`Base, SessionLocal, engine, get_db, normalize_database_url`), `app.models` (all 12 models + enums), `app.exceptions`, `app.rate_limit.limiter` (decorated routes need `request: Request`), `app.schemas` (`CamelModel`, `Page[T]`, `MessageResponse`), `app.dependencies.PaginationParams`.
- `app.auth.security`: `hash_password, verify_password, create_access_token(user_id, role), decode_access_token, hash_token, generate_refresh_token() -> (raw, hash, expires_at)`. Refresh tokens are opaque random strings stored as SHA-256 hashes in `refresh_tokens`.
- `app.auth.dependencies`: `DbSession`, `CurrentUser`, `OptionalUser`, `InstructorUser`, `StudentUser`, `require_role(*roles)`, `get_current_user`. Admins pass every role guard.
- `app.services.access`: `get_course_or_404, ensure_course_owner, ensure_course_member, is_course_owner, is_course_member, is_enrolled, get_assignment_for_user, ensure_assignment_owner, get_submission_for_user, can_view_submission, ensure_submission_instructor, get_review_or_404, get_roast_or_404, roast_course`.
- Router registration: **do NOT edit `app/routers/__init__.py` or `app/main.py`** — the orchestrator registers routers. Each router module exposes `router = APIRouter(tags=[...])` using full sub-paths (e.g. `@router.get("/courses/{course_id}")`), no prefix (the `/api/v1` prefix is added by `api_router`).
- Sync SQLAlchemy 2.0 `Session` (`select()` style), eager-load with `selectinload/joinedload` to avoid N+1. Endpoints `async def` per CLAUDE.md are fine (FastAPI runs sync DB calls inside; keep them short) — or use plain `def` endpoints for DB-heavy handlers; either is acceptable, be consistent within your router.
- Validate your router by writing a throwaway script/test that builds `FastAPI()` + `app.include_router(api_router_like)` with YOUR router(s) + the exception handlers from `app.main` (or simply temporarily include in a scratch app), using SQLite + `Base.metadata.create_all`. Delete throwaway files when done. Put any tests you want to keep in `backend/tests/test_<module>.py` with a local fixture — Phase 3 TEST-AGENT will consolidate.

## 4. Pipeline contract (Submissions ↔ AI Review)

Owned by SUBMISSIONS backend agent — `app/services/code_fetcher.py`:
```python
class CodeFetchError(Exception): ...           # .message is user-facing (Tanglish ok), .code e.g. "GITHUB_NOT_FOUND"
@dataclass(frozen=True)
class CollectedFile: path: str; language: str | None; size_bytes: int; content: str
@dataclass(frozen=True)
class FetchResult: files: list[CollectedFile]; commit_sha: str | None
def submission_upload_dir(submission_id: int) -> Path          # settings.UPLOAD_DIR / "submissions" / str(id)
def validate_github_url(url: str) -> str                       # normalised URL or raise BadRequestError(code="INVALID_GITHUB_URL")
def fetch_github_repo(url: str) -> FetchResult                 # raises CodeFetchError
def collect_uploaded_files(upload_dir: Path) -> FetchResult    # reads saved uploads (code files and/or one .zip), safe extraction; raises CodeFetchError
```
Submission service saves raw uploads into `submission_upload_dir(id)` at submit time (after size/count checks → 413), then queues the pipeline.

Owned by AI REVIEW backend agent — `app/services/pipeline.py`:
```python
def run_pipeline(submission_id: int) -> None
```
- Sync function, run via FastAPI `BackgroundTasks.add_task(run_pipeline, submission.id)`. Opens its own `SessionLocal()`. Never raises (logs + marks `failed`).
- Steps: `fetching` (skip if SubmissionFile rows exist) → `reviewing` (skip if Review exists) → `roasting` (skip if Roast exists) → `completed`. Retry = call again (resumes at first incomplete step). Re-review = service deletes Review (cascade deletes Roast) then calls again.
- Tests MUST be able to run it synchronously with a mocked `app.services.ai_client`.

## 5. Frontend shared core (ALREADY WRITTEN — import, don't modify)

- `useAuth()` from `@/hooks/useAuth` → `{user, isAuthenticated, isLoading, login, register, loginWithTokens, logout, updateProfile, refreshUser}`; `AuthProvider` in `@/context/AuthContext`; `ProtectedRoute` in `@/components/auth/ProtectedRoute`. `App.tsx` routes + role guards are DONE — do NOT edit `App.tsx`.
- UI kit `@/components/ui` (GlassCard, GradientButton, PageWrapper, AnimatedList, AnimatedInput, TextReveal, LoadingScreen, EmptyState, SpiceChip, StatusBadge, ScoreRing, MotionBox/MotionSpan), layout `@/components/layout/*`, `@/lib/{routes (ROUTES, paths), spice (SPICE_META), status (STATUS_META, SEVERITY_COLOR_SCHEME), queryClient, env (GOOGLE_LOGIN_URL)}`, theme semantic tokens (`bg.surface`, `text.muted`, ...).
- Data fetching: TanStack Query (`useQuery`/`useMutation`), query keys as arrays e.g. `['courses']`, `['course', id]`, `['assignment', id]`, `['submission', id]`, `['review', submissionId]`, `['roast', submissionId]`, `['roastWall', courseId, sort]`, `['leaderboard', courseId]`, `['dashboard']`, `['mySubmissions', page]`. Put your module's hooks in `src/hooks/use<Module>.ts`.
- Errors: `getErrorMessage(err)` from `@/services/api` → show via Chakra `useToast` or inline `Alert`. Every async action handles errors.
- Rules: no `any`, no `console.log`, no `style={{}}` / inline styles, never `dangerouslySetInnerHTML` (render markdown/roasts/code as text — `whiteSpace="pre-wrap"`; for assignment markdown, plain pre-wrapped text is acceptable), accessible labels, responsive (mobile first), light + dark mode via semantic tokens.
- Tone: friendly Madurai Tanglish microcopy in empty states / loading / success toasts ("Semma! Course create aachu 🎉"), but keep form labels and errors clear English.
- Tests: `renderWithProviders(ui, { route, as: 'student' | 'instructor' | User, auth })` from `src/__tests__/test-utils.tsx`, `makeUser()`. Mock services with `vi.mock('@/services/xService')`. Put tests in `src/__tests__/<module>/*.test.tsx`. Keep `npm run type-check && npm run lint && npm test` green for the WHOLE project at the end (other agents' in-progress files may briefly fail — re-run before reporting).

## 6. File ownership (write ONLY your files)

| Agent | Backend files | Frontend files |
|---|---|---|
| AUTH | `app/schemas/auth.py`, `app/schemas/user.py`, `app/services/auth_service.py`, `app/auth/google.py`, `app/routers/auth.py` | `pages/{LandingPage,LoginPage,RegisterPage,GoogleCallbackPage,ProfilePage}.tsx`, `components/auth/*` (except ProtectedRoute.tsx), `__tests__/auth/*` |
| COURSES | `app/schemas/{course,assignment}.py`, `app/services/{course_service,assignment_service}.py`, `app/routers/{courses,assignments}.py` | `pages/{CoursesPage,CourseCreatePage,CourseJoinPage,CourseDetailPage,AssignmentCreatePage,AssignmentDetailPage,AssignmentEditPage}.tsx`, `components/{courses,assignments}/*`, `hooks/{useCourses,useAssignments}.ts`, `__tests__/courses/*` |
| SUBMISSIONS | `app/schemas/submission.py`, `app/services/{submission_service,code_fetcher}.py`, `app/routers/submissions.py` | `pages/{SubmitPage,AssignmentSubmissionsPage,MySubmissionsPage}.tsx`, `components/submissions/*`, `hooks/useSubmissions.ts`, `__tests__/submissions/*` |
| REVIEW | `app/schemas/{review,roast}.py`, `app/services/{ai_client,review_service,roast_service,roast_guard,pipeline}.py`, `app/prompts/*.md`, `app/routers/{reviews,roasts}.py` | `pages/SubmissionResultPage.tsx`, `components/{review,roast}/*`, `hooks/{useSubmissionStatus,useReview}.ts`, `__tests__/review/*` |
| WALL | `app/schemas/wall.py`, `app/services/{wall_service,leaderboard_service}.py`, `app/routers/{wall,public}.py` | `pages/{RoastWallPage,LeaderboardPage,PublicRoastPage}.tsx`, `components/wall/*`, `hooks/useWall.ts`, `__tests__/wall/*` |
| DASHBOARD | `app/schemas/dashboard.py`, `app/services/dashboard_service.py`, `app/routers/dashboard.py` | `pages/{DashboardPage,SettingsPage}.tsx`, `components/dashboard/*`, `hooks/useDashboard.ts`, `__tests__/dashboard/*` |

Endpoint → router mapping: `roasts.py` = GET `/submissions/{id}/roast`, POST `/roasts/{id}/regenerate`, PUT `/roasts/{id}/visibility`. `wall.py` = PUT `/roasts/{id}/share`, POST/DELETE `/roasts/{id}/reactions...`, GET `/courses/{id}/roast-wall`, GET `/courses/{id}/leaderboard`. `public.py` = GET `/public/roasts/{slug}`. `reviews.py` = GET `/submissions/{id}/review`, PUT `/reviews/{id}/override`, POST `/submissions/{id}/re-review`. `dashboard.py` = GET `/dashboard`.

Need a shared helper that isn't listed? Put it in YOUR files (e.g. a private `_to_submission_out()` in your service). Backend helper to build a denormalised `SubmissionOut` lives in `app/schemas/submission.py` + `app/services/submission_service.py` (SUBMISSIONS agent) — DASHBOARD agent may import `SubmissionOut` and `submission_service.to_submission_out(submission)` (signature: `def to_submission_out(submission: Submission) -> SubmissionOut`, expects `assignment.course`, `student`, `review` loaded). If not yet present when you validate, wait and retry.
