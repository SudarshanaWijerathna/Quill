# Quill

A lightweight collaborative document editor: create, format, import and share rich-text documents.

| Layer    | Stack                                                                 |
| -------- | --------------------------------------------------------------------- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Lucide, Tiptap |
| Backend  | Python 3.11+, FastAPI, SQLAlchemy 2, Pydantic v2, SQLite, JWT          |
| Testing  | Pytest (backend), Vitest (frontend, where useful)                     |

## Project structure

```
quill/
├── backend/            FastAPI application
│   ├── app/
│   │   ├── main.py     App setup, CORS, error handling, router registration
│   │   ├── config.py   Settings from environment (.env)
│   │   ├── db.py       SQLAlchemy engine, session, Base
│   │   ├── models.py   User, Document
│   │   ├── schemas.py  Pydantic request/response models
│   │   ├── auth.py     Password hashing, JWT, current-user dependency
│   │   ├── seed.py     Development demo data
│   │   └── routers/    health, auth, documents (mounted under /api)
│   └── tests/          Pytest suite
├── frontend/           React SPA
│   └── src/
│       ├── auth/           Auth context, provider, route guards
│       ├── components/     Layout, shared UI, documents/, ui/ (shadcn)
│       ├── pages/          Login, Register, Dashboard, Document, placeholders
│       └── lib/            API client, types, formatting utilities
├── AI_WORKFLOW.md      Log of AI-assisted development
└── README.md
```

## Prerequisites

- Node.js 20+ (developed on 24) and npm
- Python 3.11+

## Setup

### Backend

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # optional; defaults work for local dev
uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000/api
- Interactive docs: http://localhost:8000/docs
- Health check: `GET /api/health`

The SQLite database (`backend/quill.db`) and tables are created automatically on startup.

### Demo accounts (development only)

```bash
cd backend
python -m app.seed            # idempotent; refuses to run when ENVIRONMENT=production
```

| Name         | Email               | Password         |
| ------------ | ------------------- | ---------------- |
| Alice Carter | `alice@example.com` | `quill-demo-123` |
| Bob Nguyen   | `bob@example.com`   | `quill-demo-123` |

Alice gets two sample documents and Bob gets one. Alternatively, set `SEED_DEMO_DATA=true` to seed on
startup. In `npm run dev`, the login page shows one-click buttons that fill in these credentials. They
are ordinary accounts with no authentication bypass.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local    # optional; defaults work for local dev
npm run dev
```

Open http://localhost:5173. In development, Vite proxies `/api/*` to `http://localhost:8000`,
so no CORS configuration is needed locally.

## API overview

All endpoints are under `/api`. Document endpoints require authentication.

| Method   | Path                  | Description                                     |
| -------- | --------------------- | ----------------------------------------------- |
| `GET`    | `/health`             | Liveness and database check                     |
| `POST`   | `/auth/register`      | Create account; starts a session                |
| `POST`   | `/auth/login`         | Log in; starts a session                        |
| `POST`   | `/auth/logout`        | Clear the session cookie                        |
| `GET`    | `/auth/me`            | Current user (401 if not signed in)             |
| `GET`    | `/auth/session`       | Session probe: `{user}` or `{user: null}` (200) |
| `GET`    | `/documents`          | List own documents (summaries, newest first)    |
| `GET`    | `/documents/shared-with-me` | Documents shared with the current user    |
| `POST`   | `/documents`          | Create a document                               |
| `GET`    | `/documents/{id}`     | Get a document (with Tiptap JSON `content`)     |
| `PATCH`  | `/documents/{id}`     | Update `title` and/or `content`                 |
| `DELETE` | `/documents/{id}`     | Delete a document                               |
| `GET`    | `/documents/{id}/shares`           | List collaborators (owner)         |
| `POST`   | `/documents/{id}/shares`           | Share by email `{email, permission, can_download}` (owner) |
| `PATCH`  | `/documents/{id}/shares/{user_id}` | Change `permission` and/or `can_download` (owner) |
| `DELETE` | `/documents/{id}/shares/{user_id}` | Revoke access (owner)              |
| `GET`    | `/documents/{id}/export?format=markdown\|text` | Download as `.md` / `.txt` (download permission) |
| `POST`   | `/documents/{id}/copy`             | Copy into the caller's own documents (download permission) |

**Authentication:** login and register set the JWT in an **httpOnly cookie**
(`quill_session`), so JavaScript never reads or stores the token. The API also accepts
`Authorization: Bearer <token>` (the token is returned in the login response) for API clients
and tests.

**Permissions** (enforced in `backend/app/access.py` for every document and sharing endpoint):

| Action                                  | Owner | Editor | Viewer |
| --------------------------------------- | :---: | :----: | :----: |
| Open and read                           |  ✓    |   ✓    |   ✓    |
| Edit content (autosave)                 |  ✓    |   ✓    |        |
| Rename, delete, manage collaborators    |  ✓    |        |        |
| Download, export, copy, print           |  ✓    |   ✓    | only "Viewer + download" |

The share dialog offers three levels: **Viewer** (view only), **Viewer + download** (view,
download, copy and print) and **Editor** (view, edit and download). They are stored as
`permission` (viewer or editor) plus `can_download`. Shares created before this option existed
were migrated with `can_download = false`, which is the safe default.

The backend enforces downloads on the export and copy endpoints, which return 403 without the
permission. PDF and Print go through the browser's print dialog, so for those the restriction is
only in the UI. The File menu items are disabled, and the print stylesheet hides the document for
viewers without download permission. Anything a viewer can see on screen can still be copied or
screenshotted. "No download" is a convenience restriction, not DRM.

A user with no access gets `404`, so the API does not reveal that the document exists. A
collaborator attempting an action their role doesn't allow gets `403`. Access is checked against
the database on every request, so permission changes and revocations take effect immediately.
Sharing is by account email only; there are no public links.

## Tests

```bash
cd backend && pytest            # API: auth, documents, ownership
cd frontend && npm test         # Vitest: autosave logic (debounce, ordering, retry)
cd frontend && npm run e2e      # Playwright: editor flows in a real browser
```

The e2e suite starts its own backend (port 8001, temporary SQLite DB with demo users) and Vite
server (port 5174), so it does not touch your running dev servers or local database. It uses the
installed Microsoft Edge by default. Set `PW_CHANNEL=chrome` to use Chrome, or run
`npx playwright install chromium` and set `PW_CHANNEL=` to use the bundled Chromium.

## Importing files

On the dashboard, **Import** (or drag a file onto the import dialog) creates a new document from a
local file and opens it. The title is the file name without its extension.

| Format | Extension | Conversion |
| ------ | --------- | ---------- |
| Plain text | `.txt` | Blank lines start new paragraphs; single line breaks are kept. Markup characters stay literal. |
| Markdown | `.md` | See the table below. Everything imports as **editable** editor content. |

| Markdown | Becomes |
| -------- | ------- |
| `#`, `##` and `###` headings (deeper levels become H3; setext `===`/`---` also work) | Headings 1–3 |
| `**bold**`, `*italic*`, `***both***`, `~~strike~~` and `` `code` `` | Bold, italic, strikethrough and inline code |
| `- item`, `1. item` (nested lists, start numbers) | Bulleted and numbered lists |
| `- [ ] todo` and `- [x] done` | A checklist with its checked states |
| GitHub-style pipe tables | A table whose first row is the header |
| Fenced code (` ```python ` or `~~~`) | A code block with that language |
| `[label](https://…)`, `<https://…>` and bare `https://…` URLs | Clickable links (http, https and mailto only) |
| `> quote` (nested, with lists inside) | A blockquote |
| `---`, `***` and `___` | A divider |

**Limits and behaviour**

- Maximum file size: **2 MB**. Files must be UTF-8 text. Empty or whitespace-only files,
  binary files and invalid UTF-8 are rejected with a clear message.
- Conversion runs in the browser (`frontend/src/lib/import/`) and produces Tiptap JSON, which is
  saved through the normal `POST /api/documents` endpoint.
- **HTML is never rendered.** Raw HTML in a file (for example `<b>`, `<img onerror=…>` or
  `<script>`) is imported as literal text.
- **Unsafe links are dropped.** Links with any scheme other than http, https or mailto
  (`javascript:`, `data:`, relative paths and so on) keep their label as plain text, without the link.
- Kept as plain text: table column alignment, footnotes, HTML blocks and indented
  (4-space) code blocks. Images become their alt text.
- A list becomes a checklist only if **every** item has a checkbox. Mixed lists stay bulleted
  lists with a literal `[ ]`.
- Not supported: `.docx`, `.pdf` and other formats, and importing several files at once.

## Editor

- Tiptap with StarterKit (including Link), CodeBlockLowlight, Table, TaskList, Placeholder and
  CharacterCount. Content is stored as **Tiptap JSON**. The extension list is defined once in
  `frontend/src/components/editor/extensions.ts` and shared with the importer tests.
- The toolbar is grouped, and scrolls sideways on small screens:
  - **History:** undo, redo
  - **Text style:** the style dropdown, H1, H2
  - **Text:** bold, italic, underline, strikethrough, inline code, link
  - **Lists:** bulleted, numbered, checklist
  - **Blocks:** quote, code block, table, divider

  Two **contextual** controls appear when relevant: a **Table** menu (insert or delete rows and
  columns, toggle the header row, delete the table) and a **language picker** for code blocks.
- **Tables:** inserted as 3×3 with a header row. `Tab` and `Shift+Tab` move between cells.
- **Code blocks:** syntax highlighting with lowlight (highlight.js common grammars, about 35
  languages). The language is stored in the block and defaults to auto-detect.
- **Links:** a dialog to insert, edit or remove links (`Ctrl/⌘+K`). Only http, https and mailto
  URLs are accepted, and bare domains and email addresses are completed automatically. Links open
  in a new tab with `rel="noopener noreferrer nofollow"`. While editing, `Ctrl/⌘+click` opens a
  link; viewers just click.
- **Security:** link hrefs are validated three times: by the dialog, by Tiptap when rendering (a
  disallowed href is never written to the DOM), and by the API, which rejects stored link marks
  that aren't http, https or mailto with a 422.
- **Shortcuts:**
  - Formatting: `Ctrl/⌘+B/I/U`, `Ctrl/⌘+Shift+S` (strikethrough), `Ctrl/⌘+E` (inline code),
    `Ctrl/⌘+K` (link)
  - Text style: `Ctrl/⌘+Alt+0–3`
  - Lists: `Ctrl/⌘+Shift+7/8/9` (numbered, bulleted, checklist)
  - Blocks: `Ctrl/⌘+Shift+B` (quote), `Ctrl/⌘+Alt+C` (code block)
  - Undo/redo and save: `Ctrl/⌘+Z`, `Ctrl/⌘+Shift+Z`, `Ctrl/⌘+S` (save now)
- **Viewers:** everything is read-only. Checkboxes can't be toggled and table cells can't be
  edited, but links stay clickable.
- **Autosave:** 800 ms debounce, one request in flight at a time, unchanged content is skipped,
  and saves are retried on failure. Pending changes are flushed when you leave the page.
- **Header:** back, the logo, the title (editable by the owner), the File menu, and the role
  badge for collaborators. On the right: the **Editing/Viewing** switch, the theme toggle, the
  save status, **Share** (owner) and the account avatar.
- **Editing and Viewing modes:** Viewing is a read-only presentation mode for people who can
  edit. It hides the toolbar and locks the content without sending a save. Switching back
  restores editing. It is *not* an authorization mechanism: viewers never see the switch, and the
  backend enforces roles independently.
- **Status bar:** fixed at the bottom right, with zoom (50–200% in 10% steps; click the
  percentage to reset) and the word count. Zoom scales only the document page.
- **File menu:**
  - **Make a copy:** a private copy owned by you, which opens immediately.
  - **Download:** Markdown and plain text are generated on the server. PDF uses the print dialog.
  - **Print.**

  Pending edits are saved first, so copies and exports include them.
- **Exports:** Markdown keeps headings, bold, italic, strikethrough, inline code, links, lists,
  task lists, quotes, code blocks with language, dividers and tables. It re-imports with the same
  structure. Underline has no Markdown syntax and is exported as plain text.
- **PDF:** "Download as PDF" opens the browser's print dialog, with a document-only print layout
  that always uses the light theme. Choose **Save as PDF** there. Quill does not generate PDF
  files on the server.
- **Theme:** light or dark. The choice is saved in `localStorage`; without one, the operating
  system setting is used. It is applied before first paint, and printing always uses the light
  palette.
- **Editor limitations:** table columns can't be resized and cells can't be merged. The editor
  chunk is about 670 kB (212 kB gzipped), lazy-loaded only when a document is opened.

## Environment variables

**Backend** (`backend/.env`)

| Variable             | Default                   | Notes                                     |
| -------------------- | ------------------------- | ----------------------------------------- |
| `DATABASE_URL`       | `sqlite:///./quill.db`    | Any SQLAlchemy URL                        |
| `JWT_SECRET`         | `dev-insecure-change-me`  | **Must** be set to a strong secret in prod |
| `JWT_EXPIRE_MINUTES` | `1440`                    | Access-token lifetime                     |
| `CORS_ORIGINS`       | `http://localhost:5173`   | Comma-separated allowed origins           |
| `COOKIE_SECURE`      | `false`                   | Set `true` when served over HTTPS         |
| `COOKIE_SAMESITE`    | `lax`                     | `none` only for cross-site deployments    |
| `SEED_DEMO_DATA`     | `false`                   | Seed demo users on startup (not in prod)  |
| `ENVIRONMENT`        | `development`             | `production` disables demo seeding        |

**Frontend** (`frontend/.env.local`)

| Variable             | Default                 | Notes                                         |
| -------------------- | ----------------------- | --------------------------------------------- |
| `VITE_API_URL`       | *(empty)*               | Backend origin for production builds          |
| `VITE_DEV_API_PROXY` | `http://localhost:8000` | Dev-server proxy target for `/api`            |
| `VITE_SHOW_DEMO_ACCOUNTS` | `false`            | Show demo-login shortcuts in production builds |

## Deployment notes

- **Frontend:** `npm run build` produces static files in `frontend/dist` (any static host).
  Configure SPA fallback to `index.html`.
- **Backend:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set `ENVIRONMENT=production`,
  a strong `JWT_SECRET` and `COOKIE_SECURE=true`. SQLite requires a persistent disk; otherwise
  point `DATABASE_URL` at Postgres.
- **Recommended: same-origin API.** Use the frontend host's rewrite/proxy feature to forward
  `/api/*` to the backend and leave `VITE_API_URL` empty. The session cookie then stays
  first-party, which browsers that block third-party cookies require.
- **Alternative: separate API origin.** Set `VITE_API_URL` to the backend URL, `CORS_ORIGINS` to
  the frontend URL, and `COOKIE_SAMESITE=none` with `COOKIE_SECURE=true`. Some browsers block
  these cross-site cookies, so the rewrite approach is more reliable.
