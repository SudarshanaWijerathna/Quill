# AI Workflow Log

This log records how AI tools were used to build Quill. It is updated as development
progresses and records only what actually happened. Planned work is labelled as planned.

## AI tools used

| Tool        | How it was used                                                                     |
| ----------- | ----------------------------------------------------------------------------------- |
| ChatGPT     | Used by the developer, outside the editor, to interpret the assignment and set the initial product scope and technology choices. |
| Claude Code | Agentic coding assistant running in VS Code. It scaffolded the project, wrote configuration and code, ran commands, and performed verification. |

---

## Entry 1: Assignment interpretation and project initialization

**Status:** Initialization complete. No product features have been implemented yet.

### 1. ChatGPT: interpreting the assignment and setting scope

*Source: reported by the developer. This step happened outside Claude Code, so its prompts and
responses are not reproduced here.*

The developer used ChatGPT to:

- Interpret the full-stack assessment brief and its 240-minute time limit.
- Turn it into a concrete MVP scope: create, rename, edit, save and reopen documents; rich-text
  formatting (bold, italic, underline, headings, bullet and numbered lists); TXT and Markdown
  import; sharing with viewer and editor permissions; separating owned documents from shared ones;
  persistence; and backend authorization with basic error handling.
- Set the technology choices: React + TypeScript + Vite, Tailwind CSS, shadcn/ui, Lucide and Tiptap
  on the frontend; FastAPI, SQLAlchemy, Pydantic, SQLite and JWT on the backend; Pytest and Vitest
  for testing.
- Set the design direction (minimal SaaS look, neutral surfaces, deep navy accent) and the
  constraints: avoid overengineering, keep real-time collaboration out of scope unless the core
  is finished, and keep deployment in mind.

The result was a structured brief, which the developer gave to Claude Code as the starting prompt.

> _Developer: add any specific ChatGPT prompts, rejected suggestions or alternatives considered here._

### 2. Claude Code: initialization and scaffolding

**Prompt (summary):** The developer gave Claude Code the brief above. It asked Claude Code to
propose an architecture and then **only** initialize the project: folder structure, Vite frontend,
FastAPI backend, essential dependencies, frontend-to-backend communication, a health-check endpoint,
a README, a `.gitignore` and env examples. Claude Code was to verify both apps start and then stop
for review.

**Completed by Claude Code:**

- Inspected the project directory. It contained only an empty `AI_WORKFLOW.md`.
- Scaffolded `frontend/` with `create-vite` (react-ts template: React 19, Vite 8, TypeScript 7).
- Installed and configured Tailwind CSS v4 (`@tailwindcss/vite`), the `@/` path alias and the
  shadcn/ui setup (Radix base, `Button` component), plus React Router and Lucide.
- Replaced the default shadcn neutral theme with navy primary design tokens and set Inter as the
  font (`frontend/src/index.css`).
- Added a small fetch wrapper (`frontend/src/lib/api.ts`) and a **temporary** `App.tsx` that calls
  the health endpoint to prove the wiring works.
- Created `backend/` with a virtualenv, pinned `requirements.txt` and `requirements-dev.txt`, and an
  `app/` package containing `main.py` (CORS, router registration), `config.py` (env-based settings),
  `db.py` (SQLAlchemy engine and session) and `routers/health.py`.
- Added `GET /api/health`, which also runs `SELECT 1` against the database, and one Pytest test for it.
- Wrote the root `README.md`, `.gitignore`, `backend/.env.example` and `frontend/.env.example`.

### 3. Initial architectural decisions and reasoning

| Decision | Reasoning |
| --- | --- |
| Separate `frontend/` and `backend/` apps with no shared monorepo tooling | Each can be deployed on its own (static host plus Python host). Shared tooling adds setup cost with no benefit at this size. |
| Vite dev proxy forwards `/api` to FastAPI on port 8000 | The browser stays same-origin in development, so there is no CORS friction locally. |
| `VITE_API_URL` and env-driven `CORS_ORIGINS` | Production uses separate frontend and backend origins, configured without code changes. |
| Flat backend layout (`main`, `config`, `db`, `routers/`) | No service or repository layers, which would be overengineering for an MVP built in 240 minutes. |
| Tables created on startup (`create_all`) instead of Alembic migrations | Faster to build. An accepted MVP trade-off, noted in the code. |
| Split `requirements.txt` and `requirements-dev.txt` | Production installs skip test-only packages. |
| Tiptap and Vitest not installed yet | Only essential dependencies now; each is added in the phase that uses it. |

### 4. Changes to AI-generated output

- **`cn` package replaced.** `shadcn init` added an npm package named `cn`, and the generated
  `utils.ts` and `button.tsx` imported from it. Claude Code replaced it with the standard local
  `cn()` helper built on `clsx` and `tailwind-merge`, rather than depend on an unvetted package for
  a three-line utility. Claude Code first uninstalled the package without noticing the generated
  imports, then caught them on the next check.
- **Theme edit redone.** Claude Code's first, regex-based edit of the theme tokens silently did not
  apply. It noticed this by inspecting the file and then edited the token block directly.
- **Vite boilerplate removed:** demo assets, `App.css`, `frontend/README.md` and
  `frontend/.gitignore`. The root README and `.gitignore` replace them.

### 5. Verification performed so far

Claude Code ran these checks and saw the results in command output:

- **Frontend:** the Vite dev server started successfully on port 5173 and served the app
  (`<title>Quill</title>`).
- **Backend:** `GET http://localhost:8000/api/health` returned
  `{"status":"ok","version":"0.1.0","database":"ok"}`.
- **Proxy:** `GET http://localhost:5173/api/health` returned the same response through the Vite proxy.
- **API docs:** `GET /docs` returned 200.
- **CORS:** a preflight request from `http://localhost:5173` returned an `access-control-allow-origin` header.
- **Build:** `npm run build` (TypeScript check plus Vite build) succeeded.
- **Backend tests:** `pytest` passed 1 of 1 (`tests/test_health.py`).

This verification covers only the project skeleton and the health endpoint. No product features
exist yet, so none have been tested.

### 6. Warnings and unresolved issues

- **Port conflict (resolved).** When the developer first started `uvicorn` manually, it failed with
  `WinError 10013`. Claude Code's verification server was still running in the background and
  holding port 8000. Claude Code stopped its servers. A leftover Vite process still held port 5173,
  so Claude Code identified it by its command line and ended it, then confirmed both ports were
  free. From now on, verification servers are stopped once checks finish.
- **Lint:** `npm run lint` (oxlint) reports 0 errors and 2 warnings. One is in shadcn's stock
  `button.tsx` (fast-refresh export rule). The other is in the temporary `App.tsx` (`setState`
  inside an effect), which will be replaced.
- **Test warning:** Pytest shows a Starlette deprecation warning about using `httpx` in its test
  client. The test is not affected.
- **Python version:** the local interpreter is a pre-release (3.11.0rc2). Deployment should use a
  stable Python 3.11 or newer.
- **JWT secret:** `JWT_SECRET` defaults to an insecure development value and must be set in production.
  (Auth itself is not built yet.)
- **No git repository yet.** The project has not been initialized with git.

---

## Entry 2: Authentication and document workspace (Phase 2)

**Status:** Complete. Built by Claude Code and verified as described below. The Tiptap editor and
sharing are intentionally **not** implemented in this phase.

### Prompt (summary)

The developer asked for: backend registration, login, bcrypt hashing, JWT, `GET /api/auth/me`, an
auth dependency and unique-email validation; a `Document` model and CRUD endpoints with ownership
checks; frontend login, registration, auth context, protected routes, persistent login and logout;
a polished dashboard (sidebar, search, recent documents, empty states, create, rename, delete and
open); optional development-only demo seeding; and backend tests. Claude Code was told to reuse
the existing architecture and not to implement the editor or sharing yet.

### Completed

**Backend**

- `app/models.py`: `User` and `Document`. Document IDs are UUID strings and `content` is a
  SQLAlchemy `JSON` column that defaults to an empty Tiptap document. Includes `created_at` and
  `updated_at`.
- `app/schemas.py`: Pydantic models. Email is validated and lowercased. Titles and names are
  stripped and cannot be empty. Passwords are 8 to 72 bytes.
- `app/auth.py`: bcrypt hashing, JWT creation and verification, the httpOnly cookie helpers, and the
  `get_current_user` dependency (accepts the cookie or an `Authorization: Bearer` header).
- `app/routers/auth.py`: `register` (409 on a duplicate email), `login` (generic 401 message),
  `logout` and `me`.
- `app/routers/documents.py`: list (own documents only, newest first, with server-generated
  plain-text previews), create, get, patch and delete. One `get_owned_document` helper enforces
  ownership on every per-document operation.
- `app/main.py`: registers the new routers and adds a JSON handler for unhandled 500 errors.
- `app/seed.py`: idempotent demo seeding (`python -m app.seed`, or `SEED_DEMO_DATA=true`). It
  refuses to run when `ENVIRONMENT=production`.
- `app/db.py`: uses `StaticPool` for in-memory SQLite so the test database works.

**Frontend**

- `lib/api.ts`: sends the session cookie with `credentials: 'include'`, reads FastAPI validation
  errors, shows a network-error message, and calls a global 401 handler. Adds typed `authApi` and
  `documentsApi` helpers.
- `auth/`: context, provider (restores the session through `/auth/me`), and the `RequireAuth` and
  `RedirectIfAuthenticated` route guards.
- Pages: login (with demo-account shortcuts shown only in dev or behind an env flag), register,
  dashboard, document page shell (loads the document, renames inline, handles 404), and
  placeholder pages for "Shared with me" and "Trash".
- Components: `AppLayout` (sidebar, user menu with logout, mobile drawer), `DocumentCard`,
  `DocumentRow`, `DocumentActions`, rename and delete dialogs, `EmptyState`, `PageHeader`,
  `FormError` and `Logo`.
- Added shadcn components: input, label, dialog, alert-dialog, dropdown-menu, skeleton. Added
  `sonner` for toasts.

### Implementation decisions and reasoning

| Decision | Reasoning |
| --- | --- |
| JWT in an **httpOnly cookie**, not localStorage | The brief said not to keep sensitive data in browser storage. JavaScript can never read the token, so an XSS bug cannot steal it. The client keeps only the user object in memory. |
| Also accept `Authorization: Bearer` | Keeps tests, Swagger and non-browser API clients simple. |
| `SameSite=lax` cookie by default | Blocks cookies on cross-site POST, PATCH and DELETE requests, which limits CSRF without a token mechanism. Settings are env-configurable for deployment. |
| Recommend proxying `/api` through the frontend host in production | Browsers increasingly block cross-site cookies, so a same-origin API is the most reliable setup. Documented in the README. |
| Non-owners get **404**, not 403 | Does not reveal that another user's document exists. |
| UUID document IDs | Document URLs cannot be guessed or counted through, which matters once sharing exists. |
| List endpoint returns summaries plus a text preview | Keeps the list payload small. Preview text is extracted from Tiptap JSON on the server. |
| `UTCDateTime` column type | SQLite drops timezone information, so timestamps would serialize without an offset and browsers would read them as local time. |
| Same 401 message for a wrong password and an unknown email, plus a dummy bcrypt check | Limits account enumeration through error messages and response timing. |
| Search is client-side | The full summary list is already loaded, so no extra endpoint is needed at MVP scale. |
| Trash and "Shared with me" are visual only | Trash was optional in the brief. Sharing is scheduled for a later phase. Both pages say honestly that nothing is there. |

### Changes to AI-generated output

- **The `cn` package came back.** `shadcn add` re-added the `cn` npm package and generated
  `import { cn } from "cn"` in five new components, the same problem as in Phase 1. Claude Code
  pointed the imports back to `@/lib/utils` and uninstalled the package again.
- **shadcn tried to overwrite `button.tsx`.** Adding `alert-dialog` prompted to overwrite the
  already-fixed `button.tsx`. With no input available, the CLI aborted and did not create
  `alert-dialog`. Claude Code reran it and answered "no" to keep the fixed file.
- **A shell heredoc command failed to parse.** Claude Code's first attempt to write several backend
  files in one shell command failed with a parse error, and no files were written. It switched to
  the file-writing tools instead.
- **Logout simplified.** The first version mutated an injected `Response`. It was changed to build
  and return an explicit 204 response.
- **Flaky test found and fixed.** `test_list_returns_only_own_documents_newest_first` passed on the
  first run and failed on a later one. Two documents created back to back could share a timestamp
  because of the clock's resolution on Windows. The test now sets explicit `updated_at` values,
  and the suite then passed five runs in a row.
- **Vite config warning fixed.** `__dirname` was replaced with `import.meta.dirname` after Vite
  flagged it as unsupported by its future native config loader.

### Verification

Run by Claude Code, with results observed in command output:

- **Backend tests:** `pytest` passed 22 of 22, five runs in a row after the flaky test was fixed.
  Coverage: registration, including email normalization and the httpOnly cookie; duplicate email
  (409); input validation (422); login through the cookie and through a Bearer token; invalid
  credentials (401, same message for both cases); `/me` without authentication or with a garbage
  token (401); logout; document create (defaults and Tiptap content), get, list (own only, newest
  first, preview), rename, update content, empty-title rejection, delete and missing document (404);
  401 on all five document endpoints without authentication; and a non-owner getting 404 on get,
  patch and delete with the owner's document unchanged.
- **Frontend:** `npm run build` (TypeScript check plus build) succeeded. `npm run lint` reported 0
  errors and 1 warning (shadcn's stock `button.tsx`).
- **End-to-end API check through the Vite proxy** (`curl` against `localhost:5173/api`):
  - Health returned ok, and an unauthenticated document list returned 401.
  - A wrong password returned 401. Logging in as the seeded Alice returned 200 with `Set-Cookie:
    quill_session=…; HttpOnly; SameSite=lax`, and `/me` returned Alice.
  - The document list returned Alice's two seeded documents with previews and UTC (`Z`) timestamps.
  - Create, rename, delete, and then a 404 on fetch all behaved as expected.
  - Bob got 404 on Alice's document. A duplicate registration returned 409, and a bad email
    returned a 422 with a structured validation error.
  - Logout returned 204, after which `/me` returned 401.
  - The SPA routes `/`, `/login`, `/register` and `/documents/:id` all returned 200.
- **Dev servers:** Claude Code's attempt to start its own verification servers failed, because the
  developer's `uvicorn --reload` and Vite servers were already running on 8000 and 5173. Claude Code
  left them running and ran the checks above against them. The reload had already picked up the new
  backend code.
- **Demo seeding:** `python -m app.seed` created Alice (2 documents) and Bob (1 document) in the
  local dev database.

**Not verified by Claude Code:** the UI has not been checked visually in a browser, because no
browser tool was available in this session. That covers layout, responsiveness, dialogs, toasts,
the mobile drawer, and the login, logout and redirect behaviour in a real browser. These still
need manual testing by the developer.

### Warnings and unresolved issues

- **Large bundle warning:** the production JS bundle is about 517 kB (161 kB gzipped), and Vite
  warns about chunks over 500 kB. Route-level code splitting could fix this later.
- **Logout is client-side only.** It clears the cookie, but the stateless JWT stays valid until it
  expires (24 hours). A token denylist or shorter tokens with refresh would close this. Out of
  scope for the MVP.
- **Seeded documents share a timestamp.** Both of Alice's seeded documents have identical timestamps
  (created in one flush), so their relative order is arbitrary. This is cosmetic.
- **Still open from Entry 1:** the Starlette `httpx` deprecation warning in tests, the pre-release
  Python 3.11.0rc2, and no git repository.

---

## Entry 3: `/auth/me` 401 investigation and the rich-text editor (Phase 3)

**Status:** Complete. Built by Claude Code and verified as described below, including in a real
browser. Sharing and file import are intentionally not implemented in this phase.

### Prompt (summary)

The developer reported `/api/auth/me` 401 errors in the browser console while Alice was logged in.
They asked Claude Code to investigate them, verify that the session survives a refresh, and not to
suppress legitimate errors. They then asked for the Tiptap editor: a header (back, logo, editable
title, save status, Share placeholder), a formatting toolbar, a styled page canvas, debounced
autosave (about 800 ms) storing Tiptap JSON, stale-response protection, Saving/Saved/Error states,
and tests for the listed scenarios.

### 1. Investigating the 401

- **How it was reproduced:** Claude Code wrote a Playwright script that drove the installed
  Microsoft Edge against the developer's running dev servers. It loaded the app logged out, logged
  in as Alice, refreshed, and recorded every `/api/auth/*` response and console error.
- **Finding:** the 401s came from the **logged-out session check**. On first load the SPA called
  `GET /auth/me`, which correctly returned 401 with no cookie. Browsers log any 4xx as a console
  error, and StrictMode's double effect in dev produced it twice. The console keeps entries
  across client-side navigation, so they were still visible after logging in. **Restoring the
  session after a refresh already worked** (`/auth/me` returned 200 and Alice stayed signed in).
- **Fix (no suppression):** added `GET /api/auth/session`, which returns `200 {"user": …}` or
  `200 {"user": null}`. Being signed out is a normal state for this probe, not an error. It also
  clears a cookie that no longer resolves to a user. `/auth/me` is unchanged and still returns 401
  without authentication, and all other 401 handling is untouched.
- **Verified:** rerunning the same browser script showed `/auth/session` returning 200 when logged
  out and when logged in, with no console errors, and the session still survived a refresh.
  Two new backend tests and one e2e test cover this.

### 2. Completed

- **Dependencies:** `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit` and `@tiptap/extensions`;
  dev-only `vitest` and `@playwright/test`.
- `lib/autosave.ts`: a framework-independent `Autosaver` class. It debounces saves (800 ms), skips
  saves when content is unchanged (compared by serialized JSON), allows **one save in flight at a
  time** (edits made during a save are sent afterwards, in order), retries after an error (5 s,
  on the next edit, or on a manual retry), flushes on dispose, and sends a `keepalive` save when
  the page unloads.
- `components/editor/useDocumentEditor.ts`: Tiptap setup (StarterKit with headings 1 to 3, link
  off and trailing node off; Placeholder; CharacterCount; content checking turned on).
- `components/editor/EditorToolbar.tsx`: undo/redo, a text-style dropdown (normal, H1 to H3), H1,
  H2, bold, italic, underline, bulleted list and numbered list. Active state comes from
  `useEditorState` with `aria-pressed`, and tooltips show the shortcuts.
- `components/editor/SaveIndicator.tsx`: Saving / Saved / Couldn't save with a Retry button.
- `pages/DocumentPage.tsx` (rewritten): loading skeleton; 404 and other error states; the header
  with back link, logo, inline title (saved on blur or Enter, Escape reverts, a pending rename is
  also saved on unmount), combined save status and Share placeholder (shows a "coming soon"
  toast); the page-like canvas (816 px wide, full width on mobile); word count; `Ctrl/⌘+S` to save
  now; a warning before unload when changes are unsaved; a flush when the tab is hidden; and a
  read-only banner if stored content fails the schema check.
- `App.tsx`: the editor route is **lazy-loaded**, and each document ID gets its own component
  instance (keyed), so switching documents can never mix state or saves.
- `index.css`: editor typography (headings, paragraphs, lists, blockquote, code, placeholder).
- Backend: `get_optional_user` and `user_from_token` in `auth.py`, and the `/auth/session` endpoint.
- Tests: `src/lib/autosave.test.ts` (Vitest), `e2e/editor.e2e.ts` and `playwright.config.ts`
  (Playwright), and new session tests in `backend/tests/test_auth.py`.
- `README.md` (editor, tests and API table) and `.gitignore` (Playwright output).

### 3. Implementation decisions and reasoning

| Decision | Reasoning |
| --- | --- |
| Autosave logic kept separate from React | It can be unit-tested with fake timers. React only wires it up. |
| One save in flight at a time, and responses never written back to the editor | Guarantees that older content cannot reach the server after newer content, and that a slow response cannot overwrite newer local edits. Simpler than server-side version checks for a single-editor MVP. |
| Saved snapshot reset to the editor's normalized JSON after loading | Tiptap fills in default attributes, so a raw comparison would trigger one pointless save. |
| The autosaver is created in an effect, not during render | StrictMode mounts, unmounts and remounts components in dev. Creating it in an effect means the disposed instance is replaced cleanly rather than left in use. |
| Each document gets its own component instance (keyed by ID) | Prevents doc A's pending save or editor state from leaking into doc B. |
| `keepalive` only when the page unloads | It is the only way a request survives a page unload. Inside the app, normal ordered saves are used, so ordering stays guaranteed. |
| No separate Underline package | Tiptap v3's StarterKit already includes Underline, and Placeholder and CharacterCount now live in `@tiptap/extensions`. Installing `@tiptap/extension-underline` as the brief suggested would register it twice. |
| `trailingNode: false` | See the bug below. Viewing a document must never modify it. |
| Playwright with the installed Edge, on isolated ports and a temporary database | No browser download is needed, and the tests never touch the developer's servers or data. |
| Editor route lazy-loaded | The main bundle fell from 518 kB to 453 kB, below Vite's warning threshold. The editor ships as its own 418 kB chunk. |

### 4. Problems found and changes to AI-generated output

- **Bug found from a screenshot: viewing a document triggered a save.** After the e2e tests
  passed, Claude Code took screenshots to check the UI and saw "Saving…" right after opening and
  clicking a document, without typing. StarterKit v3's TrailingNode extension appends an empty
  paragraph on the first interaction, which counts as a document change. The fix was disabling
  `trailingNode`. A regression test was added ("opening and clicking … sends no save"). Claude Code
  confirmed it **fails with the old configuration** (1 save request instead of 0) and passes
  with the fix. The existing debounce test had missed this because it always typed.
- **Side effect on the developer's dev database:** the screenshot script that exposed this bug ran
  against the dev servers, so before the fix it saved a trailing empty paragraph to Alice's seeded
  "Q4 Product Roadmap" document and updated its timestamp. The change is harmless. After the fix,
  the same script made 0 save requests.
- **Encoding slip.** Temporarily re-enabling TrailingNode with a PowerShell 5.1 read and write
  turned `…` into `â€¦` in the placeholder string and added a UTF-8 byte-order mark. Both were
  fixed. A search found no other affected files.
- **Vitest "failed to find the runner".** This came from the shell's lowercase `c:` working
  directory, which made Vitest load itself twice. It is not a code problem: from a correctly
  cased `C:\` path, all 8 tests pass.
- **Lint warning fixed:** a ref was written during render (`titleRef.current = title`). It now
  updates in an effect.

### 5. Verification

Run by Claude Code, with results observed in command output:

- **Backend:** `pytest` passed 24 of 24 (two new session tests).
- **Unit:** `vitest` passed 8 of 8 for `Autosaver`: debounce, skipping unchanged content, no
  overlapping saves with in-order follow-up saves, a slow older save not marking newer edits as
  saved, error then automatic retry, manual retry, and dispose flushing pending edits (including
  during an in-flight save).
- **Browser end-to-end tests (Playwright with Edge):** passed 9 of 9, and the full suite passed in
  three separate runs (8 tests in the first two, 9 after the regression test was added):
  1. A logged-out load has no 401s or console errors, and the session survives a refresh.
  2. Opening a seeded document renders its stored heading and list.
  3. Heading (from the style menu), bold (`Ctrl+B`), italic, underline, a bulleted list, H2 and a
     numbered list are applied, autosaved, and **all still present after a refresh**. The toolbar
     shows the active state, and the stored content is Tiptap JSON with the expected node and
     mark types.
  4. Typing a 43-character sentence sends at most 2 save requests, and no further requests follow.
  5. Opening and clicking a document without editing sends no save request.
  6. Renaming in the header persists through a refresh and shows on the dashboard.
  7. Typing in doc A and leaving within the debounce still saves A. Doc B then gets its own content
     and nothing leaks between them.
  8. With every PATCH failing with a 500, the status shows "Couldn't save" and the text stays in
     the editor. After the backend recovers, Retry saves it and it survives a refresh.
  9. An inaccessible document shows the not-found state.
- **Build and lint:** `npm run build` passed. `npm run lint` reported 0 errors and 1 warning
  (shadcn's stock `button.tsx`).
- **Visual check:** Claude Code reviewed Edge screenshots of the editor (desktop and mobile)
  and the dashboard (desktop).

### 6. Warnings and unresolved issues

- **No multi-tab or multi-user conflict detection.** Two tabs editing the same document follow
  last-write-wins. Expected for an MVP without real-time collaboration, but it should be revisited
  when editor sharing lands.
- **Unload saves are best effort.** A `keepalive` save when the page unloads cannot wait for an
  in-flight save, so the two requests could arrive out of order in that one case. Bodies over
  about 60 KB fall back to a normal request, which the browser may cancel. The unload warning
  covers this for the user.
- **Leftover e2e databases.** Each e2e run leaves a temporary `quill-e2e-<pid>.db` in the OS temp
  folder. The six left by this phase's runs were deleted. The test server holds the file open
  until Playwright stops it, so automatic cleanup was not added.
- **Mobile toolbar.** On narrow screens the toolbar scrolls horizontally (underline and lists are
  off-screen until scrolled). It works but is not ideal.
- **Still open:** the Starlette `httpx` deprecation warning, the pre-release Python 3.11.0rc2,
  and no git repository.

---

## Entry 4: Document sharing and permission management (Phase 4)

**Status:** Complete. Built by Claude Code and verified as described below. No real-time
collaboration and no public links, as instructed.

### Prompt (summary)

The developer asked for a `DocumentShare` model (unique per document and user); share, list,
update and revoke endpoints, plus `shared-with-me`; centralized authorization for the
owner, editor and viewer roles, enforced on the backend; a share dialog; a working "Shared with
me" page; read-only mode for viewers; editors who can edit but see no owner controls; and tests
for 10 listed scenarios.

### Completed

**Backend**

- `models.py`: `DocumentShare` (id, document_id, user_id, permission, created_at). It has a
  `UNIQUE(document_id, user_id)` constraint, a `CHECK` that permission is `viewer` or `editor`,
  and cascading foreign keys to `documents` and `users`. `Document.shares` and `User.shares` use
  ORM cascades.
- `db.py`: turns on `PRAGMA foreign_keys=ON` for SQLite connections. SQLite ignores foreign keys
  and `ON DELETE CASCADE` by default.
- `access.py` (new): **central authorization**. `get_document_access()` resolves the role (owner,
  editor or viewer) from the database on each request. `require_role()` raises 404 for no access
  and 403 when the role is insufficient. It defines the `READ`, `EDIT_CONTENT` and `MANAGE` role
  sets.
- `routers/documents.py`: every per-document endpoint goes through `require_role`. GET needs READ.
  PATCH needs MANAGE if `title` is present (rename is owner-only, even when combined with a content
  change) and EDIT_CONTENT otherwise, so viewers are rejected even for an empty patch. DELETE
  needs MANAGE. Added `GET /documents/shared-with-me`, declared before `/{document_id}` so the
  path isn't captured as an ID. Responses now include `role` and `owner`.
- `routers/shares.py` (new): owner-only list, create, update and revoke. Create normalizes the
  email; returns 400 for sharing with yourself, 404 for an unknown email, 409 for a duplicate
  (including a unique-constraint race) and 422 for an invalid permission.
- `schemas.py`: `UserPublic`, `Role`, `Permission`, `ShareCreate`, `ShareUpdate` and `ShareOut`.
  `role` and `owner` were added to the document schemas.

**Frontend**

- `components/sharing/ShareDialog.tsx` (new): email input with a viewer/editor picker, a Share
  button, inline errors (duplicate, unknown user, self), the list of people with access (owner
  first), per-person permission changes and "Remove access", loading and error states, toasts,
  and a note that only invited people can open the document.
- `pages/DocumentPage.tsx`: role-aware.
  - **Viewer:** the editor is not editable, the toolbar and save indicator are hidden, the title
    is plain text, there is no Share button, and a "View only · Shared by …" badge and banner are
    shown. No autosaver is created, so no requests are sent.
  - **Editor:** editing and autosave work, with a "Can edit" badge. Rename and Share are hidden.
  - **Owner:** unchanged, plus the Share dialog.
  - **Access removed mid-session:** a save rejected with 403 or 404 locks the editor and shows
    "Your edit access … was removed". Auto-retry stops for these errors through the new
    `Autosaver` option `shouldRetry`.
- `pages/SidebarPages.tsx` (renamed from `PlaceholderPages.tsx`): "Shared with me" now loads from
  the API, with search, owner and access badges, loading, error and empty states, and no
  rename/delete actions.
- `DocumentRow.tsx`: actions are now optional, and an optional `meta` slot was added.
  `useDocumentEditor.ts` gained an `editable` option. `types.ts` and `api.ts` gained the role and
  share types and `sharesApi`.

### Implementation decisions and reasoning

| Decision | Reasoning |
| --- | --- |
| One `require_role()` used by every endpoint | One place to audit, and no endpoint can forget a check. |
| No access → 404, insufficient role → 403 | Strangers cannot find out that a document exists. Collaborators get an accurate "not allowed". |
| Role read from the database on every request (not stored in the JWT) | Permission changes and revocations take effect on the very next request. |
| `create_all` for the new table, not Alembic | The change only *adds* a table, and `create_all` creates missing tables without touching existing ones. This matches the project's documented MVP approach. Verified on the developer's existing dev database: `users`, `documents` and the new `document_shares` table. |
| Duplicate invite → 409, not an upsert | It is explicit: changing the permission of someone who already has access is a separate, visible action in the list. The unique constraint also catches concurrent duplicates. |
| Listing collaborators is owner-only | Least privilege. The brief makes managing collaborators owner-only, and editors and viewers see the owner's name on the badge. |
| A rename combined with a content edit is rejected as a whole for editors | No partial application of a forbidden request. |
| Share responses expose only `id`, `name` and `email` (`UserPublic`) | No private fields reach collaborators. |
| The frontend hides controls but the backend enforces everything | The UI is a convenience. The tests check 403 and 404 at the API directly. |
| No new dependencies | The permission picker reuses the existing DropdownMenu, and the dialog reuses Dialog. |

### Changes to AI-generated output and issues found

- **Lint warning in the new dialog:** `load()` reset an error state synchronously inside an
  effect. The reset moved into the response handlers.
- **Misaligned headings, found from a screenshot:** the first "Shared with me" layout had column
  headings (Name, Owner, Access, Last edited) that did not line up with the row contents. The
  heading row was removed, and each row now labels itself ("Shared by Alice Carter · View only").
- **File rename:** `PlaceholderPages.tsx` became `SidebarPages.tsx`, since "Shared with me" is no
  longer a placeholder.
- **No side effects on the developer's data:** screenshots this phase were taken in the isolated
  e2e environment with a temporary spec, deleted afterwards. The only call against the
  developer's dev server was a read-only check (Bob logs in and gets an empty `shared-with-me`).

### Verification

Run by Claude Code, with results observed in command output:

- **Backend:** `pytest` passed **37 of 37**, including 13 new tests in `tests/test_sharing.py`
  that cover the 10 requested scenarios and more:
  1. The owner shares by email (case-insensitive), and the collaborator list shows the recipient.
     Self-share returns 400, an unknown email 404, an invalid email or permission 422, and a
     duplicate 409 (the existing permission is unchanged).
  2. `shared-with-me` lists the document with its role, owner and preview. Shared documents are
     not mixed into the recipient's own list or the owner's shared list.
  3. A viewer can GET the document, with role `viewer`.
  4. A viewer gets 403 for a content patch, a title patch, an empty patch, delete, sharing and
     listing collaborators. The document is unchanged afterwards.
  5. An editor can patch content, and the owner sees the change.
  6. An editor gets 403 for a rename, a rename combined with content, delete, and all share
     management. The document is unchanged afterwards.
  7. An unrelated user gets 404 for get, patch, delete and the share list, and an empty
     `shared-with-me`. A share on one document grants nothing on another. Sharing endpoints
     return 401 without authentication.
  8. Owner changes viewer → editor (edit then allowed) → viewer (edit rejected on the next request).
     An invalid permission returns 422 and an unknown user 404.
  9. Revoking returns 204, and the collaborator list is empty.
  10. **Immediately** after revoking, the same still-valid token gets 404 on get and patch, and an
      empty `shared-with-me`. Revoking twice returns 404. Deleting a document removes its shares.
- **Unit:** `vitest` passed 9 of 9 (new: no automatic retry when `shouldRetry` returns false).
- **Browser end-to-end tests (Playwright with Edge):** passed **11 of 11**, including the 9
  existing editor tests (unchanged behaviour) and 2 new sharing tests. The full flow used two
  separate sessions:
  1. Alice shares through the dialog, Bob appears as Viewer, and a duplicate invite shows "already
     has access".
  2. Bob sees the document in "Shared with me" (View only, Alice Carter) and not under My documents.
  3. Bob opens it read-only: the editor is not editable, there is no toolbar, no Share button and
     no title input, the badge and banner show, typing changes nothing, and **0 PATCH requests**
     are sent.
  4. Alice switches Bob to Editor in the dialog. After reloading, Bob has the toolbar but no
     rename or Share, his edit autosaves, and Alice sees it through the API.
  5. Alice removes Bob **while Bob has the editor open**. His next save is rejected, the editor
     locks with the "access was removed" banner, and the server content does not contain that
     edit. After reloading, Bob sees "Document not found" and an empty "Shared with me".
  6. A user with no share sees "not found", and the API returns 404.
- **Build and lint:** `npm run build` passed. Lint reported 0 errors and 1 warning (shadcn's stock
  `button.tsx`).
- **Visual check:** Claude Code reviewed screenshots of the share dialog, the viewer page
  (desktop and mobile) and "Shared with me".
- **Dev environment:** the developer's running `uvicorn --reload` picked up the change.
  `document_shares` was created in the existing `quill.db` with existing data intact, and
  read-only API calls succeeded.

### Remaining limitations

- **No notifications:** shared users are not notified (no email). They find the document under
  "Shared with me".
- **Sharing only with existing accounts:** sharing requires an existing account. Inviting
  unregistered emails is out of scope. The 404 for an unknown email lets an owner check whether an
  email is registered, which is the accepted trade-off of sharing by email.
- **Collaborators' views don't update live:** permission changes reach an open editor only on its
  next request. An editor downgraded to viewer finds out on their next save, and a viewer
  upgraded to editor must reload. This is expected without real-time features.
- **Ownership can't be transferred**, and editors cannot re-share. Both are by design.
- **Concurrent editors:** last write wins, as noted in Entry 3. Sharing makes this more likely
  (owner and editor in the same document at once).
- **Still open:** the Starlette `httpx` deprecation warning, the pre-release Python 3.11.0rc2,
  and no git repository.

---

## Entry 5: TXT and Markdown file import (Phase 5)

**Status:** Complete. Built by Claude Code and verified as described below. DOCX and PDF are out of
scope, as instructed.

### Prompt (summary)

The developer asked for an Import Document action on the dashboard. Requirements:

- `.txt` and `.md` support, with Markdown headings (H1–H3), paragraphs, bold, italic and both list
  types kept.
- No rendering of arbitrary HTML.
- Validation of the extension, a 2 MB limit, and empty, malformed and unsupported files.
- Protection against duplicate imports from repeated clicks.
- Loading and error states, a file picker, and drag-and-drop if practical.
- The new document opens automatically.
- Tests for 7 listed scenarios, plus README and AI_WORKFLOW updates.

### Completed

- `frontend/src/lib/import/convert.ts` (new): a dependency-free converter to Tiptap JSON.
  - **`textToDoc`:** blank lines separate paragraphs, and single line breaks become hard breaks.
  - **`markdownToDoc`:** ATX and setext headings (levels 4–6 capped at H3), paragraphs with soft
    and hard line breaks, `**`/`__` bold, `*`/`_` italic (no mid-word `_`), `***` bold-italic,
    inline code, bullet and numbered lists with nesting and start numbers, blockquotes, fenced
    code, horizontal rules, and backslash escapes. Links become "label (url)" and images their
    alt text.
  - Anything else stays plain text. The output uses only node types registered by the editor's
    StarterKit.
- `frontend/src/lib/import/importFile.ts` (new):
  - **`validateFile`** runs instantly on selection: extension allowlist (`.txt`, `.md`,
    case-insensitive), 0-byte check and 2 MB limit.
  - **`readImportFile`** does the full read: strict UTF-8 decoding (`TextDecoder` with `fatal`,
    which removes a BOM), rejection of NUL bytes (binary) and whitespace-only files, conversion
    inside a try/catch, and the title from the file name.
- `frontend/src/components/documents/ImportDialog.tsx` (new):
  - A click-or-drop zone, supported formats and limit shown up front, a selected-file row
    (name, size, remove), and inline errors.
  - The Import button shows a spinner and "Importing…".
  - A **synchronous ref guard** stops a double submit before React re-renders, and the dialog
    can't be closed mid-import.
  - On success it navigates to the new document.
- `DashboardPage.tsx`: an **Import** button next to New document, and "Import a file" in the empty
  state. Its old text said import was coming "soon", which is now true.
- `api.ts`: `documentsApi.create(title, content)`.
- Backend `schemas.py`: create and update now **validate content**. It must be a Tiptap `doc`
  whose `content` is a list, and is capped at 10 MB of serialized JSON. Otherwise the response
  is 422.

### Implementation decisions and reasoning

| Decision | Reasoning |
| --- | --- |
| Conversion in the browser, then the existing `POST /documents` | As requested ("use the existing document creation API"). No new endpoint, no multipart parsing, no new backend dependency. |
| A hand-written Markdown converter instead of a library | Common libraries (marked, markdown-it) produce **HTML**, which would then have to be parsed and sanitized, the opposite of "avoid rendering arbitrary HTML". Emitting Tiptap JSON directly means HTML is never interpreted, and no dependency is added. The trade-off is a smaller feature set, documented in the README. |
| The converter is tested against the editor's **real Tiptap schema** | The unit tests build the schema from the same StarterKit configuration as the editor and call `Node.fromJSON(...).check()`. A converter bug would fail tests instead of breaking the editor at runtime. |
| Two validation stages: instant checks on select, then a full read on import | The user gets immediate feedback on extension and size. Decoding and conversion happen only when importing. |
| Extension allowlist, not MIME types | Browsers report `.md` MIME types inconsistently (`text/markdown`, `text/x-markdown` or empty). |
| Strict UTF-8 plus a NUL check | "Malformed content" (binary, or another encoding) gets a clear error instead of garbled text with replacement characters. |
| Server-side content validation and size cap | The 2 MB limit is enforced in the browser, but the API must not trust clients. This also protects autosave. The 10 MB JSON cap leaves room for the JSON overhead of a 2 MB Markdown file. |
| Ref guard plus disabled button against duplicates | A disabled button alone has a race: two clicks in the same tick both run before React re-renders. |
| `.txt` single newlines become hard breaks, while in `.md` they are joined | Plain text has no markup, so its line structure is the formatting. In Markdown, soft line breaks are spaces by definition, and hard breaks use two trailing spaces or a backslash. |

### Changes to AI-generated output and issues found

- **Converter bug found by its own unit test:** `**bold *and italic***` closed the bold at the
  first `**` of the trailing `***`. The bold rule now refuses a closing `**` that is directly
  followed by `*`.
- **TypeScript error:** `TiptapDoc` was declared as an `interface`, which is not assignable to
  `Record<string, unknown>`. It was changed to type aliases rather than adding a cast.
- **Wrong e2e selector:** `ul > li` also matched the nested list's item (3 instead of 2). The test
  now uses `.ProseMirror > ul > li`. The application was correct.
- **Title rule changed:** Claude Code's first `titleFromFileName` replaced `-` and `_` with
  spaces. It was changed to keep the file name exactly (minus the extension), since rewriting it
  would surprise users.
- **Screenshot timing, not a bug:** one screenshot showed a pale (apparently disabled) Import
  button with a valid file selected. A rerun that waited for the button showed `isEnabled() ===
  true` and a normal style. The first capture had been taken before the re-render or during the
  dialog's open animation.

### Verification

Run by Claude Code, with results observed in command output:

- **Unit:** `vitest` passed **24 of 24**, including 15 new import tests:
  - **Plain text:** paragraph and line-break handling, and that Markdown and HTML stay literal.
  - **Markdown:** H1–H3, the H4 cap and setext headings; bold, italic, bold-italic and code;
    nested emphasis; unmatched and mid-word markers left alone; bullet and ordered lists with
    nesting and start numbers; soft and hard breaks; blockquotes, code fences, rules, links,
    images and escapes; HTML kept as literal text.
  - **Malformed input:** 16 samples, all producing schema-valid output.
  - **File validation:** extension allowlist and case, no extension, 0 bytes, over 2 MB (exactly
    2 MB accepted), whitespace-only, binary (NUL) and invalid UTF-8 files; and title derivation.
  - Every converted document is checked against the editor's real Tiptap schema.
- **Backend:** `pytest` passed **40 of 40** (3 new): non-`doc` content returns 422 on create and
  update; oversized content returns 422; and an imported document is owned by its creator, listed
  only for them, and returns 404 for another user.
- **Browser end-to-end tests (Playwright with Edge):** passed **17 of 17** (6 new, plus the 11
  existing editor and sharing tests):
  1. **TXT:** importing `Meeting notes.txt` opens the new document with the title "Meeting notes",
     3 paragraphs and one hard break, and a literal "#" (no heading). All of it is still there
     after a refresh.
  2. **Markdown:** H1, H2, H3, bold, italic, 2 top-level bullets with a nested item, and 3
     numbered items, with `<b>raw html</b>` shown as text (no `<b>` element). All of it is still
     there after a refresh. The stored JSON block types are exactly
     `heading, paragraph, heading, bulletList, heading, orderedList`.
  3. **Rejected files:** `.docx` gets "aren't supported", a 0-byte file gets "empty", 2 MB + 1 byte
     gets "The limit is 2.0 MB", and the Import button is disabled for each. A whitespace-only file
     is rejected on import, and no document is created.
  4. **Duplicate clicks:** two synchronous clicks against a slowed server send **exactly 1**
     POST.
  5. **Drag-and-drop:** dropping a `.md` file imports it.
  6. **Ownership:** the imported document's role is `owner` and its owner is Alice. Bob gets 404
     and doesn't see it in his list.
- **Build and lint:** `npm run build` passed. Lint reported 0 errors and 1 warning (shadcn's stock
  `button.tsx`).
- **Visual check:** screenshots of the dashboard's Import button, the dialog with a `.docx` error,
  and the dialog with a valid file selected. They were taken in the isolated e2e environment, with
  the temporary spec deleted afterwards.

### Remaining limitations

- **Markdown subset:** tables, task lists, strikethrough and footnotes import as plain text.
  Links lose their link behaviour (the editor has no link support) but keep the URL as text.
- **Deeply indented Markdown:** list indentation is measured in spaces (tabs count as 4). Unusual
  mixed indentation may nest differently than a full CommonMark parser would.
- **One file at a time:** dropping several files shows an error.
- **Large files are converted in the browser:** a 2 MB file is converted on the main thread.
  Tested for correctness but not profiled; a very large file may briefly freeze the UI.
- **Still open:** the Starlette `httpx` deprecation warning, the pre-release Python 3.11.0rc2,
  and no git repository.

---

## Entry 6: Rich content (tables, code blocks, links, task lists, strike/quotes/dividers)

**Status:** Complete. Built by Claude Code and verified as described below. No charts, DOCX/PDF
or real-time collaboration, as instructed.

### Prompt (summary)

The developer asked for these editor features in priority order, each editable, persisted
through autosave and refresh, and importable from Markdown:

1. Tables (insert, add and delete rows and columns, header row, GFM import)
2. Code blocks with syntax highlighting and language metadata
3. Links (dialog, edit and remove, URL validation, unsafe schemes blocked)
4. Task lists
5. Better blockquotes, dividers and strikethrough

Requirements: existing documents must stay compatible, viewers must stay read-only, imported
HTML must never be trusted, the toolbar must be grouped and scroll on mobile, there must be tests
for every content type, and complexity had to be estimated first.

### Complexity estimate (given before implementation)

| Feature | Estimate | Basis (checked in `node_modules` first) |
| --- | --- | --- |
| Tables | Medium | Needs `@tiptap/extension-table`, a contextual menu, a GFM parser and CSS. |
| Code highlighting | Low–medium | `extension-code-block-lowlight` + `lowlight` use the same `codeBlock` node name, so they stay compatible with existing documents. |
| Links | Medium | Link is already in StarterKit (it was disabled). Its source shows `renderHTML` already refuses disallowed hrefs. Needs a dialog plus backend validation. |
| Task lists | Low | TaskList and TaskItem are already in `@tiptap/extension-list` (a StarterKit dependency). The source shows read-only mode reverts checkbox clicks. |
| Strike, quote, divider | Low | All three are already in StarterKit, and quotes and rules are already imported. |

All five were judged safe for the deployment timeline and implemented in priority order.

### Completed

- **`components/editor/extensions.ts` (new):** the single source of truth for the schema, used
  by the editor *and* the importer tests:
  - StarterKit with Link (`openOnClick: false`, autolink, `isAllowedUri: isSafeUrl`,
    `rel="noopener noreferrer nofollow"`, `target="_blank"`), TrailingNode still off, and its
    `codeBlock` replaced by `CodeBlockLowlight` (common grammars).
  - TaskList, TaskItem (nested), Table (not resizable), TableRow, TableHeader, TableCell,
    Placeholder and CharacterCount.
- **`EditorToolbar.tsx` (rewritten):**
  - Labelled groups: History, Text style, Text formatting, Lists, Blocks.
  - New buttons: strikethrough, inline code, link, checklist, quote, code block, insert table
    and divider.
  - Contextual menus: **Table options** (rows, columns, header row, delete) and **Code language**
    (auto-detect plus 21 languages).
  - Scrolls horizontally on small screens. `Ctrl/⌘+K` opens the link dialog.
- **`LinkDialog.tsx` and `link-state.ts` (new):**
  - Insert with or without a selection (asks for display text when nothing is selected), edit
    with the current href pre-filled, remove, and an open-in-new-tab preview.
  - Validates through `normalizeUrl`.
- **`lib/links.ts` (new):** `isSafeUrl` allows only http and https (with a host) and mailto (with
  an address). `normalizeUrl` adds `https://` to bare domains and `mailto:` to email addresses.
- **`useDocumentEditor.ts`:** uses the shared extensions, and `Ctrl/⌘+click` opens a link while
  editing.
- **`index.css`:** styles for tables (including cell selection), checklists (checked items struck
  through), links, strikethrough, quotes, code blocks, and a small highlight.js token theme in the
  Quill palette instead of an extra theme stylesheet.
- **`lib/import/convert.ts` (rewritten):**
  - **Tables:** GFM pipe tables with or without outer pipes, `\|` escapes, padding and
    truncation, inline formatting in cells.
  - **Task lists:** checked states and nesting. A list becomes a checklist only if every item has
    a checkbox.
  - **Code fences:** the language is taken from the info string, ` ``` ` and `~~~` are supported,
    and the closing fence must match.
  - **Inline:** `~~strike~~`, plus **real link marks only for safe URLs** (including `<autolinks>`
    and bare `https://` URLs without trailing punctuation).
  - **Blockquotes:** lazy continuation lines.
  - Marks are now objects, so links can carry their `href`.
- **Backend `schemas.py`:** stored link marks are validated anywhere in the tree (including
  tables), and anything other than http, https or mailto returns a 422.
  **`documents.py`:** list previews now include text from table cells, task items, code blocks
  and quotes.
- **Dependencies added:** `@tiptap/extension-table`, `@tiptap/extension-code-block-lowlight`,
  `lowlight` and `highlight.js` (its peer). `@tiptap/extension-list` became a direct dependency;
  it was already installed through StarterKit.

### Implementation decisions and reasoning

| Decision | Reasoning |
| --- | --- |
| One shared `createExtensions()` | Before this phase the importer tests copied the StarterKit configuration by hand. A shared list means the tests validate against the editor's *actual* schema, so drift is impossible. |
| CodeBlockLowlight instead of a custom highlighter | It keeps the `codeBlock` node name and `language` attribute, so earlier documents load unchanged. This was verified by an e2e test with legacy-shaped content. |
| lowlight `common` grammars, not `all` | Around 35 popular languages instead of 190+. The editor chunk is lazy-loaded, so the cost only applies when a document is opened. |
| Hand-written token CSS instead of a highlight.js theme | It matches Quill's palette and avoids a global stylesheet. |
| Link security in three layers: dialog, Tiptap `isAllowedUri`, backend | The browser checks are user-friendly. The backend layer matters because a crafted API request could otherwise store a `javascript:` link that other collaborators (including viewers) would see. |
| Unsafe Markdown links keep only their label | The text is preserved without creating a dangerous or broken link. |
| A checklist only when every item has a checkbox | Tiptap can't mix task items and normal list items in one list. Keeping mixed lists as bullets with a literal `[ ]` loses nothing. |
| Non-resizable tables | Column widths add stored `colwidth` state and a resize UI. Tables are fully editable without it. |
| Table and language controls are contextual | Keeps the default toolbar short. They only appear when the cursor is in a table or code block. |

### Changes to AI-generated output and issues found

- **A muddled assertion Claude Code wrote, then rewrote:** the first draft of the safe-links unit
  test had a convoluted `filter/slice/concat` expectation. It was replaced with direct checks: the
  first three nodes, the exact list of link hrefs, and no `javascript:` or `data:` text.
- **Lint warning:** `LinkDialog.tsx` exported a helper next to the component, which breaks fast
  refresh. `readLinkState` moved to `link-state.ts`.
- **Two failing e2e tests, both test-design errors (the app was correct):**
  - The table test deleted the row and column containing the cursor, which were Ada's row and the
    Role column. The test now clicks into the newly inserted row and column first, and also checks
    "Toggle header row".
  - The task test read the `<li>` text, which includes Tiptap's screen-reader label ("Task item
    checkbox for …"). Claude Code checked Tiptap's source to confirm the label is visually hidden,
    then pointed the test at the content `<div>`.
- **A cross-test isolation failure in the full run:** the existing sharing test expected Bob's
  "Shared with me" page to be completely empty. The new rich-content viewer test, which runs
  earlier against the same seeded database, shares a document with Bob. The sharing test now
  asserts that the *revoked* document is absent, through the UI and the API. The full suite then
  passed twice in a row.
- **Bundle size investigation:** the main chunk measured about 531 kB mid-phase. A search of the
  built main chunk found no highlight.js, lowlight, ProseMirror or Tiptap code, so the editor
  libraries stay in the lazy chunk. The final build's main chunk is 468 kB (147 kB gzipped).

### Verification

Run by Claude Code, with results observed in command output:

- **Unit:** `vitest` passed **39 of 39** (15 new). Every converted document is checked with
  `Node.fromJSON(schema).check()` against the shared editor schema.
  - **Tables:** structure, header and body cells, inline marks and `\|` in cells; padding and
    truncation; no outer pipes; a pipe in normal text is not a table.
  - **Code:** fenced code kept verbatim, including Markdown and HTML characters, with
    `python`/`null` language; an unclosed fence.
  - **Links:** link marks only for https, mailto, `<autolinks>` and bare URLs; `javascript:`,
    `data:` and relative links reduced to their label; trailing period excluded; a link combined
    with bold.
  - **Task lists:** checked states and nesting; a mixed list stays a bullet list.
  - **Strike, quotes, rules:** `~~strike~~` including strike plus bold; nested quotes, lists in
    quotes and lazy continuation; all four rule spellings.
  - **URL helper (`links.test.ts`):** 13 dangerous or malformed URLs rejected (`javascript:` in
    mixed case and with a leading space, `data:`, `vbscript:`, `file:`, `ftp:`, protocol-relative,
    relative, an empty mailto and more). Allowed: http, https and mailto, plus normalization.
- **Backend:** `pytest` passed **52 of 52** (12 new):
  - 7 unsafe hrefs rejected with 422, including mixed case, a leading space, `data:`, `vbscript:`,
    `file:`, empty and null.
  - An unsafe link nested inside a table cell rejected on update.
  - 3 safe hrefs accepted.
  - A document with a table, a code block with a language, a checked task, a struck quote and a
    rule **round-trips exactly**, and its preview includes the text.
- **Existing data:** the new validator was run read-only over all 5 documents in the developer's
  dev database. All 5 passed, so their autosave will keep working.
- **Browser end-to-end tests (Playwright with Edge):** passed **25 of 25** (8 new, plus the
  existing 17), with the full suite passing twice in a row:
  1. **Tables:** insert 3×3 with a header; type in cells with Tab; insert and delete a column;
     insert and delete a row; toggle the header row off and on. After a reload the content is
     intact, a cell can still be edited, and that edit survives another reload.
  2. **Code:** inline code with `Ctrl+E`; a code block set to TypeScript. After a reload it has the
     `language-typescript` class, `const` is highlighted as a keyword and the comment as a
     comment, and the stored attribute is `language: "typescript"` with verbatim text.
  3. **Links:**
     - `javascript:alert(1)` is rejected in the dialog, and `example.com/docs` becomes
       `https://example.com/docs`.
     - The link can be edited with `Ctrl+K` (pre-filled) and removed.
     - A mailto link can be inserted with display text. After a reload it is intact and has
       `rel=noopener`.
  4. **Task lists:** ticking an item, then reloading: the checked and unchecked states persist in
     the DOM and in the stored `attrs.checked` values.
  5. **Strikethrough, quote and divider** persist after a reload.
  6. **Legacy content:** a `codeBlock` without a `language` attribute opens with no
     content-error banner, and can be edited and saved.
  7. **Markdown import of every new structure:**
     - The table (with bold and strike in cells), Python code (highlighted), the safe link, the
       checklist states, the quote and the rule all import correctly.
     - The `javascript:` link is *not* created.
     - `<img onerror=…>` appears as text: there is no `<img>` element and the script never ran
       (`window.__xss` is undefined).
     - Editing a cell and ticking a task after the import both persist after a reload.
     - The stored block types are exactly as expected.
  8. **Viewer:** on a shared rich document the editor isn't editable and there's no toolbar.
     Clicking a checkbox is reverted, typing in a table cell changes nothing, links stay clickable
     with `target="_blank"`, and **0 PATCH requests** are sent.
- **Build and lint:** `npm run build` passed. Lint reported 0 errors and 1 warning (shadcn's stock
  `button.tsx`).
- **Visual check:** screenshots of an imported rich document on desktop (with the Table menu
  shown) and on mobile. The toolbar scrolls sideways (`scrollWidth` 790 in a 390 px viewport) and
  the page itself doesn't overflow.

### Remaining limitations

- **Tables:** column widths can't be changed and cells can't be merged or split. Markdown column
  alignment (`:---:`) is not preserved.
- **Code highlighting:** only the "common" highlight.js grammars are included (about 35
  languages). Other languages keep their stored `language` value but are shown without
  highlighting. Auto-detect, the default, can guess wrong on short snippets.
- **Links:** there is no hover preview or popover. Editing happens through the toolbar button or
  `Ctrl/⌘+K`. Relative and anchor links aren't supported (by design).
- **Markdown import:** footnotes, HTML blocks, indented (4-space) code blocks and images (alt text
  only) are not converted.
- **Bundle:** the lazily loaded editor chunk is now **667 kB** (212 kB gzipped), up from 418 kB,
  mostly highlight.js grammars and the table extension. Vite reports its size warning for this
  chunk. It only loads when a document is opened. The main chunk is 468 kB (147 kB gzipped).
- **Still open:** the Starlette `httpx` deprecation warning, the pre-release Python 3.11.0rc2,
  and no git repository.

---

## Entry 7: UI/UX refinements, download permissions and the File menu

**Status:** Complete. PDF is a **partial** implementation (browser print-to-PDF, not a
server-generated file), reported as such. Built by Claude Code and verified as described below.

### Prompt (summary)

The developer reported a Vite runtime error ("`LinkDialog.tsx` does not provide an export named
`readLinkState`") and asked Claude Code to find and fix its underlying cause. Then:

- **Header:** save status before Share, an avatar after Share, a persisted light/dark theme, and
  `quill.svg` as logo and favicon.
- **Status bar:** fixed bottom-right, with zoom (50–200%) and the word count.
- **Modes:** an Editing/Viewing presentation mode that is not an authorization mechanism.
- **Sharing:** three levels (Viewer, Viewer + download, Editor) enforced on the backend, with a
  safe migration for existing shares.
- **File menu:** Make a copy, PDF, Markdown and TXT downloads, and Print.
- Tests for all of it, plus README and AI_WORKFLOW updates.

### 1. The `readLinkState` runtime error

- **Investigation:** the source was already correct. `EditorToolbar.tsx` imported `readLinkState`
  from `./link-state`, and nothing imported it from `LinkDialog`. Claude Code requested the
  transformed module from the developer's running Vite server, which served
  `import { readLinkState } from "/src/components/editor/link-state.ts"`. It then loaded a
  document in Edge: the editor and toolbar rendered with **no page or console errors** and no
  save requests.
- **Root cause (Claude Code's own mistake):** in Entry 6, Claude Code moved `readLinkState` out
  of `LinkDialog.tsx` in **two separate edits**: it first removed the export, then updated the
  import in `EditorToolbar.tsx`. The developer's dev server hot-reloaded between the two, so a
  browser tab briefly held an `EditorToolbar` that still imported from `LinkDialog`. Browsers
  cache a failed ES module import until the page fully reloads.
- **Resolution:** no code change was needed; a full reload of that tab clears it. Nothing was
  suppressed. Lesson recorded: when moving an export between files, update the importer and
  exporter in one atomic step while a dev server is running.

### 2. Completed

**Backend**

- `models.py`: `DocumentShare.can_download` (boolean, `server_default=false`).
- `migrations.py` (new): an idempotent startup migration. It checks the live schema and runs
  `ALTER TABLE document_shares ADD COLUMN can_download BOOLEAN NOT NULL DEFAULT FALSE` only if the
  column is missing. It is called after `create_all` in `main.py` and `seed.py`.
- `access.py`: `DocumentAccess.can_download` is true for owners and editors, and comes from the
  share for viewers. New `require_download()`.
- `schemas.py`: `can_download` on document summaries and details, `ShareCreate`, `ShareUpdate`
  (either field, at least one required) and `ShareOut`, where editors are always reported as
  `true`.
- `routers/shares.py`: editors always store `can_download = true`. A downgrade to viewer without
  an explicit `can_download` resets it to `false`, so editor-era rights are not silently kept.
- `routers/documents.py`:
  - `GET /documents/{id}/export?format=markdown|text` returns an attachment with an ASCII and an
    RFC 5987 UTF-8 filename and `Cache-Control: no-store`.
  - `POST /documents/{id}/copy` creates a private copy, "Copy of …", owned by the caller.
  - Both go through `require_download`.
- `export.py` (new): a Tiptap JSON → Markdown and plain-text serializer. Marks open and close only
  where they change, spaces move outside emphasis markers, special characters are escaped, and
  tables are written as GFM. The output uses the importer's syntax, so documents round-trip.

**Frontend**

- **Theme:** `lib/theme.ts`, `ThemeToggle.tsx` and `ThemedToaster.tsx`, plus an inline script in
  `index.html` that applies the saved theme before first paint. The theme is stored in
  `localStorage` as a per-viewer preference and falls back to `prefers-color-scheme`. Printing
  temporarily switches to light. The `.dark` tokens were retuned to a navy palette, with dark
  syntax colours.
- **Logo:** `quill.svg` was copied to `public/` (the original stays at the project root) and is
  used by `Logo.tsx` and as the favicon. The old Vite `favicon.svg` was removed. On the navy
  auth panel the mark sits on a white tile, and that panel keeps the fixed brand navy in both
  themes.
- **Editor header (`DocumentPage.tsx`):** back, logo, title and File menu on the left. On the
  right: `ModeToggle`, `ThemeToggle`, `SaveIndicator`, Share and `UserAvatarMenu`. The save
  indicator collapses to an icon on small screens.
- **`StatusBar.tsx` and `lib/zoom.ts`:** fixed bottom-right with zoom −/+, the percentage (click
  to reset) and the word count. CSS `zoom` is applied to the page canvas only, and `pb-24` keeps
  the last lines clear of the bar.
- **`ModeToggle.tsx`:** Editing/Viewing as a radio group, shown only to users who can edit.
  `editor.setEditable(x, false)` means **no update event, so no autosave**. Viewing hides the
  toolbar and makes the title read-only.
- **`FileMenu.tsx`:** Make a copy; Download (PDF, Markdown, Plain text); Print.
  - Pending autosave is flushed first, so copies and exports include the latest edits.
  - Every item is disabled, with an explanation, when the user can't download.
  - Markdown and TXT are fetched from the export API and saved as a file.
- **Sharing UI:** `ShareDialog.tsx` has three levels with descriptions. "Shared with me" and the
  editor role badge show "View only", "View & download" or "Can edit".
- **Print CSS:** shows only the document page, without the zoom. For users without download
  permission (`data-print-blocked`), the document is hidden in print as a deterrent.

### 3. Implementation decisions and reasoning

| Decision | Reasoning |
| --- | --- |
| `can_download` column rather than a third `permission` value | The existing `CHECK (permission IN ('viewer','editor'))` stays valid on existing databases, and edit rights and download rights are separate concerns. |
| A small idempotent startup migration instead of Alembic | `create_all` never alters existing tables, so a new column needs a migration. One checked `ALTER TABLE` matches the project's documented MVP approach without adding tooling. It was verified on the developer's existing database and by a test that builds the old schema. |
| Existing shares default to no download | Least privilege: nobody gains access through the migration. |
| Markdown/TXT export and copy run on the server | Downloads must be enforced on the backend. Client-side generation would let any viewer bypass the check. |
| **PDF through the browser's print dialog ("Save as PDF")** | Server-side PDF needs a library plus a bundled Unicode font. Without the font, text such as curly quotes, em dashes or accented names fails. The brief allowed reporting PDF as incomplete. Browser printing is reliable in every major browser and renders the real editor output. Trade-offs: it isn't a direct file download, and its permission gate is UI-only. |
| Mode switching uses `setEditable(…, false)` | Tiptap emits an update event by default, which would reach the autosaver. With `emitUpdate: false` a mode switch is never treated as a change. |
| Copies and exports flush autosave first | Otherwise a copy made within 800 ms of typing would miss the latest words. A dedicated e2e test covers this. |
| Theme in `localStorage` plus a pre-paint script | It is a per-viewer preference, not shared state, and the script avoids a light flash on load for dark-mode users. |
| CSS `zoom` on the canvas | It reflows layout (unlike `transform: scale`), so scrolling and widths stay correct. The e2e test confirms that clicking to place the cursor and typing work at 150%. |

### 4. Changes to AI-generated output and issues found

- **The runtime error** came from Claude Code's own non-atomic edit in Entry 6 (see section 1).
- **Two failed scripted edits:** a bash heredoc carrying a Python edit script failed to parse,
  and nothing ran. The script was written to a scratchpad file and run from there. Separately, a
  Python-generated filename helper contained a mangled string literal with a raw carriage return;
  it was replaced with a `UNSAFE_FILENAME_CHARS` set, edited by position because the broken line
  couldn't be matched as text.
- **Duplicate save indicator (16 e2e failures):** Claude Code first rendered the save indicator
  twice, a desktop copy and a mobile row, with one hidden by CSS. That duplicated the test id and
  would have created two live `role="status"` regions announcing every save. It is now a single
  indicator whose label is screen-reader-only on small screens.
- **Wrong click count in the zoom test:** the test clicked "Zoom out" 6 times from 100%. Only 5
  steps reach 50%, so the 6th click hit the correctly disabled button and timed out.
- **Privacy gap closed during implementation:** downgrading an editor to viewer would have kept
  `can_download = true` from the editor period. `update_share` now resets it unless the request
  sets it explicitly, and a test covers this.

### 5. Verification

Run by Claude Code, with results observed in command output:

- **Runtime error:** the module served by the dev server had the correct import, and a fresh Edge
  load of the editor had no page or console errors.
- **Backend:** `pytest` passed **64 of 64** (12 new in `tests/test_downloads.py`):
  - The exact Markdown output for every supported structure, including escaping (`2\*3`,
    `\[x\]`, `a \| b`, `\# not a heading`), and readable plain text.
  - All three levels are stored and reported, and editors always have download.
  - A viewer gets 403 for Markdown, text and copy but can still read. Viewer + download can export
    and copy but not edit. No access returns 404, no authentication 401, and an unsupported format
    (`pdf`) 422.
  - The attachment headers have the ASCII and UTF-8 filenames.
  - Download rights can be toggled and take effect immediately, a downgrade resets them, and only
    the owner can change them.
  - A copy is owned by the requester, isn't shared, has identical content, and leaves the original
    independent. Long titles are truncated to 200 characters.
  - **Migration:** on a Phase 4 shares table with an existing row, it adds the column with
    `false`, and running it again does nothing.
- **Developer's dev database:** after the developer's `uvicorn --reload` restarted,
  `document_shares` had `can_download`, all 5 documents were intact, and read-only API calls
  succeeded.
- **Unit:** `vitest` passed 39 of 39, unchanged.
- **Browser end-to-end tests (Playwright with Edge):** passed **36 of 36**, twice in a row (11
  new, plus the 25 existing, unchanged):
  1. **Theme:** toggling sets the `dark` class and `localStorage`, it survives a reload and carries
     over to the editor (the surface colour really changes), and toggling back to light persists.
  2. **Logo and favicon:** the `/quill.svg` image loads (`naturalWidth > 0`) on the login,
     dashboard and editor pages; `link[rel=icon]` points to `/quill.svg`, which is served as
     `image/svg+xml`.
  3. **Header order:** save status, then Share, then the avatar, on the right side.
  4. **Zoom:** 110% sets the canvas `zoom` to 1.1 and widens the canvas, while the toolbar height
     is unchanged. Zoom is clamped at 200% and 50%, with the buttons disabled at the limits, and
     the percentage resets. At 150%, clicking and typing edits and saves correctly.
  5. **Word count:** `position: fixed`, bottom-right, still inside the viewport after scrolling an
     80-paragraph document to the end. The last paragraph sits above the bar, and the count updates
     from 480 to 482 words.
  6. **Viewing mode:** the editor isn't editable, the toolbar and title input are hidden, typing
     changes nothing, and **0 PATCH requests** are sent. Back in Editing, the editor is editable
     and its edits save and persist.
  7. **Three levels through the dialog:**
     - **Viewer + download:** badge, no mode switch, Markdown download works, and PATCH returns 403.
     - **Viewer:** the File items are disabled with an explanation, the export API (both formats)
       and copy return 403, and the print layout hides the document.
     - **Editor:** mode switch present and export allowed.
     - The final share state matches through the API.
  8. **Exports:** `Export doc.md` contains the heading, bold and link, the task, the table and the
     Python fence. `Export doc.txt` is plain. Re-importing the downloaded Markdown gives the same
     block types.
  9. **PDF and Print:** `window.print` is stubbed and called by both the PDF and the Print items,
     and the "Save as PDF" hint is shown. With print media emulated, the header and status bar are
     hidden and the document is visible.
  10. **Make a copy:** Bob, as Viewer + download, copies Alice's document. It opens as Bob's own
      (editable title "Copy of …", editable content), contains identical JSON, and returns 404 for
      Alice.
  11. **Copy with unsaved edits:** a copy made immediately after typing, before the debounce,
      contains the new words.
- **Build and lint:** `npm run build` passed. Lint reported 0 errors and 1 warning (shadcn's stock
  `button.tsx`).
- **Visual check:** screenshots of the editor in light and dark, the File menu with its Download
  submenu, the three-level permission picker (dark), the dark login page and the mobile editor,
  which has no horizontal page overflow.

### 6. Remaining limitations

- **PDF is partial:** it goes through the browser's print dialog, with no direct `.pdf` download,
  so the user picks "Save as PDF". Page headers and footers depend on the browser's print
  settings.
- **Print and PDF restrictions are UI-level:** the backend can't stop printing. A viewer without
  download permission can still copy text or take screenshots of what they're allowed to see.
  This is a convenience restriction, not DRM. Markdown, TXT and copy *are* enforced by the
  backend.
- **Exports:** underline is dropped in Markdown (it has no syntax for it). Plain-text tables are
  tab-separated.
- **Zoom** isn't remembered between visits, and there are no `Ctrl+` and `Ctrl−` shortcuts for
  it, because those belong to browser zoom.
- **Mobile header:** on a 390 px screen it holds back, title, mode, theme, status, Share and the
  avatar. It fits, but long titles truncate early.
- **Bundle:** the editor chunk is 675 kB (214 kB gzipped) and the main chunk 477 kB (149 kB
  gzipped). Vite's size warning remains for the lazily loaded editor chunk.
- **Still open:** the Starlette `httpx` deprecation warning, the pre-release Python 3.11.0rc2,
  and no git repository.

---

## Entry 8: Final delivery (last UI fixes, Git, production deployment)

**Status:** Complete. **Deployed and verified at https://quill-docs-assessment.fly.dev.**

### Prompt (summary)

With about 70 minutes left, the developer asked Claude Code to finish without adding major
features:

- **Phase A:** a dashboard card menu with Rename, Share, Download and Delete, respecting
  permissions; move File to the right end of the toolbar row; keep the toolbar visible but
  disabled in Viewing mode.
- **Phase B:** `.gitignore` and secrets review, Git initialization and a commit, and production
  configuration.
- **Phase C:** all test suites, the production build, lint, and checks for localhost URLs,
  credentials and authorization.
- **Phase D:** deploy, and verify the public URLs before claiming success.
- **Phase E:** README, ARCHITECTURE, AI_WORKFLOW, SUBMISSION and VIDEO_URL.

### Phase A: UI corrections

- **Card menu:** `DocumentActions.tsx` shows Rename, Share and Delete to owners only, and a
  Download submenu (Markdown or text, through the permission-checked export API) whenever
  `can_download` is true.
  - For shared rows, the menu shows only what the user may do. A viewer without download
    permission gets no menu.
  - The dashboard opens the existing `ShareDialog`.
  - `saveBlob` moved to `lib/download.ts` and is shared with the File menu.
- **Toolbar:**
  - `EditorToolbar` gained a `readOnly` prop and a `trailing` slot. The File menu now sits at the
    far right of the toolbar row and was removed from under the title.
  - The toolbar is always visible. In Viewing mode, and for viewers, the formatting controls are
    disabled (`aria-disabled` on the toolbar).
  - Decision: the toolbar uses an explicit `readOnly` prop rather than Tiptap's editable state,
    because `setEditable(…, false)` emits no event the toolbar could react to.
- **Tests:** three e2e assertions that expected the toolbar to be *hidden* were updated to expect
  it *disabled*, and a card-menu e2e test was added. The full e2e suite passed **37 of 37**.

### Phase B: Git and production configuration

- **Secrets review:** `.gitignore` already excluded `.env*`, `*.db`, virtualenvs,
  `node_modules`, `dist` and the Playwright output. The only sensitive-looking file present was
  the ignored local `backend/quill.db`.
- **Git:** initialized (`main`); 108 files staged. Claude Code checked that no env files,
  databases, virtualenvs, builds or test artifacts were staged, then made the first commit with
  the developer's existing git identity.
- **Single-origin production:** when `FRONTEND_DIST` is set, FastAPI serves `/assets`, static
  files and an SPA fallback, while `/api/*` keeps JSON 404s. Claude Code checked this locally:
  the SPA routes, `/quill.svg` and the assets were served, an unknown `/api` path returned 404,
  and an encoded `../` path-traversal attempt returned `index.html`, not the file.
- **Fail-fast in production:** with `ENVIRONMENT=production`, the app refuses to start unless
  `JWT_SECRET` is strong (32+ characters, not the dev default) and `COOKIE_SECURE` is true. This
  was verified locally: it raised `RuntimeError`.
- **Deployment files:**
  - `Dockerfile`: multi-stage (Node build, then Python 3.12 slim) running as a non-root user.
  - `.dockerignore`.
  - `fly.toml`: one machine, the `quill_data` volume at `/data`, HTTPS forced, and the
    `/api/health` check.
- **Hosting choice:** the only hosting CLI installed and logged in was `flyctl`, on the
  developer's account. Its remote builder meant no local Docker was needed. Same-origin hosting
  avoids the cross-site cookie problems documented since Phase 2.
- **Data implications, explained before acting:** the developer's local database was left
  untouched. Production starts from an empty database on a new volume, and existing local data was
  not migrated.

### Phase C: verification before deployment

- Backend `pytest` passed **64 of 64**, unit `vitest` passed **39 of 39**, and Playwright passed
  **37 of 37**. The production build passed, and lint showed 0 errors and 1 warning (shadcn's
  stock `button.tsx`).
- **Hardcoded localhost:** found only in the dev default for `CORS_ORIGINS` (overridden in
  `fly.toml`) and in the link-URL normalizer's pattern. The frontend uses relative `/api`.
- **Credentials:** the only one found was the **intentionally public demo password** (README, dev
  login shortcuts, tests, seed). There is no real secret in the repository, and the dev JWT
  default is rejected in production.
- **Authorization audit (route by route):**
  - Public: only `register`, `login`, `logout` and `health`; `session` allows an optional user.
  - Login required: every document and share route.
  - Central check: every per-document route calls `require_role` or `require_download`.
  - A first scripted audit printed nothing because its dependency walk didn't match this FastAPI
    version, so it was replaced with a direct source scan.

### Phase D: deployment (problems were real and are recorded)

1. **Resources created:** the app `quill-docs-assessment`, the 1 GB volume `quill_data` (encrypted,
   daily snapshots), and the `JWT_SECRET` Fly secret, generated locally and never printed or
   written to disk.
2. **Deploy 1 failed** at `npm ci` with Node 22. Claude Code had kept only the last 25 lines of
   output, which were npm usage text, and assumed an npm version mismatch.
3. **Deploy 2 failed** the same way with Node 24. A build-only rerun with the **full log** showed
   the actual error: `EUSAGE … Missing: @emnapi/core@2.0.0-beta.2 from lock file`. The lockfile,
   generated on Windows, lacks Linux-only optional dependencies. The fix was `npm install` in the
   image (it keeps the locked versions and adds the missing packages), explained in a comment.
   Node 24 was kept to match local development.
4. **Deploy 3 succeeded.**
5. **Public verification** used `frontend/scripts/verify-prod.mjs` (Playwright with Edge against
   the live URL). The first run stopped with "Invalid URL", a bug in the script itself: browser
   request contexts need absolute URLs. After the fix, **19 of 19 checks passed**:
   - health; demo accounts (created through the public registration endpoint, since production
     seeding is disabled by design)
   - login cookie `HttpOnly; Secure; SameSite=lax`; unauthenticated 401; SPA deep link; favicon
   - UI login; bold text, autosave and title persisting after a refresh
   - Markdown import with a heading, task list and table
   - sharing to Bob; Bob sees the document under "Shared with me", has a read-only editor, gets
     403 for a PATCH and 403 for an export without download permission
   - the owner's export works; no page errors
6. **Persistence verified:** after `fly apps restart`, Alice's documents were identical before and
   after, with the machine using volume `vol_r68xeolzwk3dz7p4`.
7. **Cleanup:** the first, crashed verification run had already created two test documents, and
   the older duplicates were deleted through the API. One "Production check" and one
   "prod-import" document remain in Alice's demo account as evidence.

### Phase E: documentation

- `README.md`: the live URL and demo accounts; a deployment section covering the architecture,
  deploy commands and secrets; a consolidated **Known limitations** section; and the
  `FRONTEND_DIST` environment variable.
- `ARCHITECTURE.md` (new): components, the authorization matrix, the data model, the deployment
  architecture and its trade-offs.
- `SUBMISSION.md` (new): what is included and not included.
- `VIDEO_URL.txt` (new): a **placeholder**. No video URL was provided to Claude Code, so none was
  invented.

### Remaining limitations

See README → Known limitations. Specific to this phase:

- Production runs a **single SQLite machine**. There are no automated backups beyond Fly's daily
  volume snapshots, and no horizontal scaling.
- **Public demo password:** anyone can sign in to the demo accounts on the live site.
- The machine **auto-stops when idle**, so the first request after a pause has a cold start.
- The Docker build uses `npm install` instead of `npm ci` (lockfile platform gap), so transitive
  versions could drift slightly between builds.

---

## Planned work (not yet implemented)

1. ~~**Authentication**~~: done in Entry 2.
2. ~~**Documents** (CRUD, ownership checks, dashboard)~~: done in Entry 2.
3. ~~**Editor**~~: done in Entry 3.
4. ~~**Import**~~: done in Entry 5.
5. ~~**Sharing**~~: done in Entry 4.
6. ~~**Testing for sharing permissions**~~: done in Entry 4.
7. ~~**Deployment**~~: done in Entry 8 (https://quill-docs-assessment.fly.dev).
