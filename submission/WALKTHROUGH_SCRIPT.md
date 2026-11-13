# Quill: Walkthrough Video Script

**Video:** `submission/walkthrough.mp4`, 4:30, 1920×1080, H.264 + AAC.

## How it was produced

- **Real application:** the recording uses the running Quill application, not mockups. Playwright drove Microsoft
  Edge with real clicks and typing against an **isolated local instance**: the production frontend build served
  by FastAPI, with a fresh temporary SQLite database containing the seeded demo accounts. Production and
  existing data were not touched.
- **Verified as it ran:** every interaction is checked during recording, for example that the link has the right
  href and text, the table rows hold the right values, the download contains the table, and Bob's copy is owned
  by him. Any failed check aborts the take.
- **What was added on top of the app:**
  - The visible mouse pointer and the caption chip in the bottom-left are overlays added for the video. Headless
    recording doesn't draw the system cursor.
  - The title, architecture and closing cards are slides.
  - At 2:57 the downloaded `.md` file is shown in the browser's plain-text view, not in Quill.
  - Everything else is the app itself, including the toasts.
- **No credentials on screen:** the demo-account shortcuts, which display the password, are compiled out of
  this build. The password is only ever typed into a password field, where it shows as dots.
- **Narration:** automated, using the Windows *Microsoft Zira* text-to-speech voice. Each clip is placed at
  the moment its section starts. To re-record the voice manually, read the narration below at the given
  timestamps; each section has enough room for its text.

## Script

| Time | Section | On screen |
| --- | --- | --- |
| 0:00 | Quill: a lightweight collaborative document editor | Title card: the Quill logo, the tagline and the feature list. |
| 0:16 | Sign in and the document workspace | Alice signs in (the password field shows dots only). The cursor moves over the dashboard: recent document cards, search and the Shared with me link. |
| 0:37 | Create and rename a document | New document opens the editor. The title is replaced with “Product launch plan” and saved with Enter. |
| 0:48 | Headings, formatting, lists and checklists | Heading 1 from the style menu, bold (Ctrl+B) and italic (Ctrl+I), a Heading 2, a bulleted list and a checklist; the first task is ticked. |
| 1:02 | Code blocks and safe links | A code block with TypeScript highlighting is set from the language picker. In the link dialog, javascript:alert(1) is rejected with an error, then a valid address is turned into the link “Quill on Fly.io”. |
| 1:18 | Editable tables | Insert table (3×3 with a header row), with cells filled using Tab. Table options → Insert row below, then the new row is filled. |
| 1:29 | Autosave and persistence | The status shows “Saved”. After a full page reload, the heading, link, code block and 4-row table are all still there. |
| 1:44 | Markdown import | Back to the dashboard → Import. The drop zone is clicked and “Release notes.md” is selected (the operating system's file dialog isn't captured in the recording). The imported document has a heading, a table, a checklist, a Python code block, a link, and literal <b>not bold</b> text. |
| 2:04 | Sharing: three permission levels | Share dialog: Bob's email is entered and the permission menu shows Viewer / Viewer + download / Editor. Viewer is chosen and Bob appears in “People with access”. |
| 2:19 | Bob as Viewer: read only, no downloads | Alice logs out and Bob signs in. In Shared with me the document is badged “View only”. It opens read-only with a disabled toolbar, and the File menu says the owner hasn't allowed downloading, copying or printing. |
| 2:38 | Owner changes the permission | Bob logs out and Alice signs in, opens the document and changes Bob to “Viewer + download”. |
| 2:57 | Viewer + download: export and make a copy | Bob signs in again; the badge reads “View & download”. File → Download → Markdown, and the downloaded .md file is shown as raw text. Back in Quill, File → Make a copy opens “Copy of Release notes”, owned by Bob. |
| 3:24 | Editor: edit with autosave, no owner controls | Alice upgrades Bob to Editor. Bob signs in, the badge reads “Can edit”, he appends “Edited by Bob.” and the status returns to Saved. |
| 3:34 | Viewing mode, theme and zoom | The Viewing mode makes the document read-only, then it switches back to Editing. The theme toggle goes to dark, the zoom to 120%, the zoom is reset, and the theme goes back to light. |
| 3:46 | Architecture | Architecture slide: React SPA ⇄ FastAPI ⇄ SQLite, single-origin deployment on Fly.io, and the test counts. |
| 4:13 | Scope and trade-offs | Out-of-scope items and the live URL. |

## Narration (read-aloud text)

**0:00 – Quill: a lightweight collaborative document editor**

This is Quill, a lightweight collaborative document editor built for the Ajaja full stack assessment. In the next few minutes, I'll walk through the real, running application: writing, importing, sharing with permissions, and exporting.

**0:16 – Sign in and the document workspace**

I'm signing in as Alice, one of the two seeded demo accounts. The session is a JSON Web Token kept in an HTTP only cookie, so the app never stores it anywhere page scripts can read. The dashboard shows Alice's own documents, with recent cards, search, and a separate Shared with me view.

**0:37 – Create and rename a document**

Creating a document opens it straight in the editor. Owners rename documents directly in the header, and the new title is saved as soon as I press Enter.

**0:48 – Headings, formatting, lists and checklists**

The editor is built on Tiptap, and documents are stored as structured JSON, not HTML. Here are headings, bold and italic text, a bulleted list, and an interactive checklist.

**1:02 – Code blocks and safe links**

Code blocks get syntax highlighting, and the language is stored with the block. Links go through a dialog that only accepts web and email addresses, so script links can never be inserted. The API rejects them too.

**1:18 – Editable tables**

Tables are fully editable. I insert one with a header row and move between cells with Tab. A contextual table menu adds and removes rows and columns.

**1:29 – Autosave and persistence**

Every change autosaves shortly after I stop typing. Saves are sent one at a time, so an older request can never overwrite newer content. After a full page refresh, everything is still here.

**1:44 – Markdown import**

Next, importing. I'll choose a Markdown file. It's converted in the browser straight into editor JSON, never through HTML, so raw HTML in a file stays plain text. Headings, tables, checklists, code, and links all arrive as editable content.

**2:04 – Sharing: three permission levels**

Now, sharing. As the owner, I invite Bob by email. There are three levels: viewer, viewer plus download, and editor. I'll start Bob as a plain viewer.

**2:19 – Bob as Viewer: read only, no downloads**

Signed in as Bob, the document appears under Shared with me. It opens read only. The toolbar is disabled, and downloading, copying and printing are unavailable. Editing, downloads and copies are refused by the backend on every request, not just hidden in the interface; printing is blocked in the browser.

**2:38 – Owner changes the permission**

Back as Alice, I upgrade Bob to viewer plus download. Changes take effect on Bob's very next request, because his role is read from the database every time.

**2:57 – Viewer + download: export and make a copy**

Bob still can't edit, but he can now download the document as Markdown, generated on the server after a permission check. He can also make a private copy that he owns.

**3:24 – Editor: edit with autosave, no owner controls**

Finally, as an editor, Bob can change the content, and his edits autosave. Renaming, deleting and sharing stay owner only.

**3:34 – Viewing mode, theme and zoom**

Anyone who can edit can switch to a read only viewing mode. There's also a light and dark theme, remembered per browser, and a status bar with zoom and the word count.

**3:46 – Architecture**

Under the hood, a React and TypeScript single page app talks to a FastAPI backend using SQLAlchemy. In production, one container on Fly dot io serves both from the same origin, with SQLite on a persistent volume. Authorization lives in one central module, and the project is covered by sixty four backend tests, thirty nine unit tests, and thirty eight browser tests.

**4:13 – Scope and trade-offs**

Given the time limit, I intentionally left out real time collaboration, DOCX and PDF import, and server generated PDF files. PDF export uses the browser's print dialog instead. Thanks for watching.

## Review notes (after checking against the source code)

**The current `walkthrough.mp4` predates these narration corrections.** Its audio still says:

- that "the browser's JavaScript never touches the token". The login response body also carries
  the token, for API clients.
- that all of the viewer restrictions are backend-enforced. Printing is blocked only in the UI.
- "thirty nine browser tests", which also appears on the architecture slide. The correct number
  is 38.

Re-record, or regenerate the narration and the slide, before submitting.

**Assessment requirements not yet demonstrated on screen.** Add these to the next recording; each
takes about 5–10 seconds:

- **Underline** (`Ctrl+U`) and a **numbered list**. Both are explicit formatting requirements,
  and both exist in the toolbar.
- **TXT import.** Both TXT and Markdown are required; only Markdown is shown. Importing a short
  `.txt` file after the Markdown import is enough.

Suggested narration for the formatting section: "Here are headings, bold, italic and underlined
text, bulleted and numbered lists, and an interactive checklist."

Suggested addition for the import section: "Plain text files work the same way; blank lines
become paragraphs."

## Features not shown in the video

The walkthrough concentrates on the requested sequence. These features exist and are covered by
the automated tests, but don't appear on screen:

- TXT import, and the import validation errors (unsupported type, empty file, files over 2 MB).
- Rename and delete from the dashboard card menu.
- PDF and Print. These open the browser's print dialog, which a headless recording can't show.
- Autosave failure and retry handling.
- Revoking access.
