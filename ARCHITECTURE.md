# Quill: Architecture

Quill is a collaborative document editor: a React single-page app and a FastAPI JSON API. In
production, both are served from **one origin** by a single container.

```
Browser (React SPA, Tiptap editor)
   │  same origin: /api/* = JSON API, everything else = SPA (index.html + hashed assets)
   ▼
FastAPI (uvicorn) ── SQLAlchemy ──► SQLite on a persistent volume (/data/quill.db)
```

## Frontend (`frontend/`)

| Area | Implementation |
| --- | --- |
| Stack | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (Radix), Lucide |
| Routing | React Router. `/login`, `/register`, `/` (my documents), `/shared`, `/trash`, `/documents/:id` (lazy-loaded editor chunk) |
| Auth state | `auth/AuthProvider.tsx` restores the session with `GET /api/auth/session`. The JWT lives only in an httpOnly cookie and is never readable by JS |
| API client | `lib/api.ts`: `fetch` with `credentials: 'include'`, typed helpers, FastAPI error parsing, and a global 401 handler |
| Editor | Tiptap 3 (`components/editor/extensions.ts` is the single schema definition): StarterKit (headings, lists, quote, rule, bold/italic/underline/strike/code, Link), CodeBlockLowlight, Table, TaskList |
| Autosave | `lib/autosave.ts`: 800 ms debounce, one request in flight at a time (ordered, never stale), unchanged content skipped, retry on failure, flush when leaving the page. Unit-tested with fake timers |
| Import | `lib/import/`: TXT and Markdown (GFM subset) converted in the browser to Tiptap JSON, never through HTML. Links are allowed only for http(s) and mailto |
| UI state | Theme in `localStorage`; zoom and Editing/Viewing mode are in-memory presentation state |

## Backend (`backend/app/`)

| Module | Responsibility |
| --- | --- |
| `main.py` | App setup, CORS, JSON 500 handler, routers, and production SPA serving (`FRONTEND_DIST`) |
| `config.py` | Settings from the environment, plus a production safety check (strong `JWT_SECRET`, `COOKIE_SECURE`) |
| `db.py` | Engine and session. SQLite foreign keys are turned on |
| `models.py` | `User`, `Document` (UUID id, Tiptap JSON `content`), `DocumentShare` (`permission`, `can_download`) |
| `migrations.py` | Idempotent startup migrations (`create_all` creates tables but never alters them) |
| `auth.py` | bcrypt, JWT (HS256), cookie helpers, `get_current_user` and `get_optional_user` |
| `access.py` | **Central authorization**: `get_document_access`, `require_role`, `require_download` |
| `export.py` | Tiptap JSON → Markdown and plain text |
| `routers/` | `auth`, `documents` (CRUD, shared-with-me, export, copy), `shares`, `health` |

### Authorization model

| Action | Owner | Editor | Viewer + download | Viewer |
| --- | :-: | :-: | :-: | :-: |
| Read | ✓ | ✓ | ✓ | ✓ |
| Edit content | ✓ | ✓ | | |
| Download, export, copy, print | ✓ | ✓ | ✓ | |
| Rename, delete, manage sharing | ✓ | | | |

- No access returns **404**, so a document's existence is not revealed. A role that isn't
  allowed to do something gets **403**.
- The role is read from the database on every request, so changes and revocations apply
  immediately.
- Content is validated on write: it must be a Tiptap `doc`, at most 10 MB, and every link href
  must be http(s) or mailto.
- Printing and PDF are only restricted in the UI. The backend can't control a browser's print
  dialog.

## Data

- **Users:** email (unique, lowercased), name, bcrypt hash.
- **Documents:** a UUID, title, Tiptap JSON content, owner and timestamps (stored as UTC).
- **Document shares:** `(document_id, user_id)` is unique, `permission` must be `viewer` or
  `editor` (CHECK constraint), and `can_download` is a boolean. Foreign keys cascade on delete.

## Production deployment (Fly.io)

- **Image:** a multi-stage `Dockerfile` that builds the SPA with Node, then runs it on Python
  3.12 slim. FastAPI serves `/api` plus the static SPA, as a non-root user.
- **Hosting:** `fly.toml` runs **one machine** with the volume `quill_data` mounted at `/data`.
  SQLite needs a single writer, so the app is deployed with `--ha=false`. The `/api/health`
  check and HTTPS are enforced.
- **Cookies:** same origin means `SameSite=Lax` and `Secure`, with no CORS or third-party-cookie
  issues.
- **Secrets:** `JWT_SECRET` is a Fly secret. The app refuses to start in production without a
  strong one.
- **Trade-offs:**
  - SQLite plus one machine means no horizontal scaling. The usual next step is Postgres:
    `DATABASE_URL` is already configurable.
  - The machine auto-stops when idle, so the first request after idling has a cold start of a
    few seconds.
