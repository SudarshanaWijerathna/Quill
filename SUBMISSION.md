# Quill: Submission

## Links

| Item | Value |
| --- | --- |
| Live application | https://quill-docs-assessment.fly.dev |
| Demo accounts | `alice@example.com` and `bob@example.com`, password `quill-demo-123` |
| Walkthrough video | See `VIDEO_URL.txt` (to be filled in by the developer) |
| Source | This repository (git, branch `main`) |

## What is included

**Application**

- `frontend/`: the React 19 + TypeScript + Vite SPA (Tailwind CSS v4, shadcn/ui, Lucide, Tiptap 3).
- `backend/`: FastAPI + SQLAlchemy + Pydantic API with SQLite, JWT in an httpOnly cookie, and
  bcrypt.

**Features**

- Registration, login, logout, and a persistent session that survives a refresh.
- Documents: create, rename, edit, autosave (debounced, ordered, retried), reopen and delete.
- Rich text: headings, bold, italic, underline, strikethrough, inline code, bulleted, numbered and
  task lists, quotes, code blocks with syntax highlighting, tables, links (safe schemes only) and
  dividers.
- Import of `.txt` and `.md` (GFM subset, including tables and task lists) into editable
  documents.
- Sharing with existing users at three levels (Viewer, Viewer + download, Editor), "Shared with
  me", and owned documents kept separate from shared ones. Every rule is enforced by the backend.
- File menu: Make a copy, download as Markdown or plain text (server-generated and
  permission-checked), PDF through the browser print dialog, and Print.
- Editing/Viewing mode, light/dark theme, zoom (50–200%) and a word-count status bar.

**Tests**

- `backend/tests/`: Pytest, 64 tests (auth, documents, ownership, sharing, download permissions,
  export, copy, migration and content validation).
- `frontend/src/**/*.test.ts`: Vitest, 39 tests (autosave logic, the Markdown/TXT converter checked
  against the real editor schema, and URL safety).
- `frontend/e2e/`: Playwright, 37 browser tests in Microsoft Edge (editor, autosave and failure
  handling, import, sharing roles, rich content, theme, zoom, viewing mode, downloads and copy).
- `frontend/scripts/verify-prod.mjs`: a smoke test for the deployed instance.

**Deployment**

- `Dockerfile`: a single-origin production image.
- `.dockerignore`.
- `fly.toml`: Fly.io app config with a persistent volume.

**Documentation**

- `README.md`: setup, stack, environment variables, demo credentials, API, import formats,
  deployment and known limitations.
- `ARCHITECTURE.md`: components, authorization model, data model and deployment architecture.
- `AI_WORKFLOW.md`: how AI tools were used, phase by phase, including mistakes and how the work
  was verified.
- `SUBMISSION.md`: this file.
- `VIDEO_URL.txt`: the walkthrough video link (placeholder until the developer adds it).

## Not included (documented in the README's known limitations)

- Real-time collaboration, DOCX/PDF import, a server-generated PDF file, public share links and
  email notifications.

## How to run locally

See **README.md → Setup**: a backend virtualenv plus `uvicorn`, and a frontend `npm install` plus
`npm run dev`. Then optionally `python -m app.seed` for the demo accounts.
