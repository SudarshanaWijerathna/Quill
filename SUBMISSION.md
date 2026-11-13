# Quill: Submission

## Links

| Item | Value |
| --- | --- |
| Live application | https://quill-docs-assessment.fly.dev (Fly.io; the first request after idle can take ~5 s to wake the machine) |
| Walkthrough video | https://drive.google.com/file/d/17ibNMye9_B2AzPi4i9LKXrHEQNcYXJuD/view?usp=sharing (4:30, 1920×1080, narrated; local copy: `submission/walkthrough.mp4`) |
| Source code | [GitHub Repository](https://github.com/SudarshanaWijerathna/Quill) |
| Demo accounts | `alice@example.com` and `bob@example.com`, password `quill-demo-123` (demo-only accounts; the password is intentionally public) |

The production demo accounts were created through the normal registration endpoint. They contain
only the documents created during the production smoke test. The seeded sample documents described
in the README exist only in local development (`python -m app.seed`).

## What is included

**Application**

- `frontend/`: the React 19 + TypeScript + Vite SPA (Tailwind CSS v4, shadcn/ui, Lucide, Tiptap 3).
- `backend/`: FastAPI + SQLAlchemy + Pydantic API with SQLite, JWT in an httpOnly cookie, and
  bcrypt.

**Features (implemented and covered by automated tests)**

- Registration, login, logout, and a persistent session that survives a refresh.
- Documents: create, rename, edit, autosave (debounced, ordered, retried), reopen and delete.
- Rich text: headings, bold, italic, underline, strikethrough, inline code, bulleted, numbered and
  task lists, quotes, code blocks with syntax highlighting, tables, links (safe schemes only) and
  dividers.
- Import of `.txt` and `.md` (GFM subset, including tables and task lists) into editable
  documents. Files up to 2 MB, UTF-8 only.
- Sharing with existing users at three levels (Viewer, Viewer + download, Editor), "Shared with
  me", and owned documents kept separate from shared ones.
  - The backend enforces editing, sharing, download and copy rules.
  - Printing is blocked only in the browser.
- File menu: Make a copy; download as Markdown or plain text, generated on the server and
  permission-checked; PDF through the browser's print dialog; and Print.
- Editing/Viewing mode, light/dark theme, zoom (50–200%) and a word-count status bar.

**Tests (results on 2026-11-13)**

- `backend/tests/`: Pytest, **64 passed** (auth, documents, ownership, sharing, download
  permissions, export, copy, migration and content validation).
- `frontend/src/**/*.test.ts`: Vitest, **39 passed** (autosave logic, the Markdown/TXT converter
  checked against the real editor schema, and URL safety).
- `frontend/e2e/`: Playwright, **38 browser tests** in Microsoft Edge (editor, autosave and failure
  handling, import, sharing roles, rich content, theme, zoom, viewing mode, downloads and copy).
- `frontend/scripts/verify-prod.mjs`: a smoke test for the deployed instance. It passed 19 of 19
  checks against the live URL at deployment.

**Deployment**

- `Dockerfile`: a single-origin production image.
- `.dockerignore`.
- `fly.toml`: Fly.io app config with a persistent volume.

**Documentation**

- `README.md`: setup, stack, environment variables, demo credentials, API, import formats,
  deployment and known limitations.
- `ARCHITECTURE.md`: components, authorization model, data model, deployment architecture and
  trade-offs.
- `AI_WORKFLOW.md`: how AI tools were used, phase by phase, including mistakes, changes to AI
  output and how the work was verified.
- `SUBMISSION.md`: this file.
- `submission/walkthrough.mp4` and `submission/WALKTHROUGH_SCRIPT.md`: the recorded walkthrough and
  its timestamped script and narration.
- `VIDEO_URL.txt`: the hosted video link.

**Not included:** screenshots or a demo GIF. The walkthrough video serves as the visual demo.

## Known limitations

These are covered in detail in README → Known limitations.

- No real-time collaboration. Concurrent edits are last-write-wins.
- No DOCX or PDF import. PDF export uses the browser's print dialog rather than a generated file.
- Viewer print/PDF restrictions are UI-only. The backend can't block printing, and anything visible
  on screen can be copied.
- Production runs on a single machine with SQLite, so there's no horizontal scaling.
- Sharing works only with existing accounts. There are no public links and no email notifications.

## How to run locally

See **README.md → Setup**: a backend virtualenv plus `uvicorn`, and a frontend `npm install` plus
`npm run dev`. Then optionally `python -m app.seed` for the demo accounts.
