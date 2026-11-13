"""Download permission levels, export (Markdown / text), copy, and the can_download migration."""

import pytest
from sqlalchemy import create_engine, inspect, text

from app.export import to_markdown, to_text
from app.migrations import run_migrations
from tests.conftest import auth_header, register

RICH = {
    "type": "doc",
    "content": [
        {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Plan"}]},
        {"type": "paragraph", "content": [
            {"type": "text", "text": "Some "},
            {"type": "text", "text": "bold", "marks": [{"type": "bold"}]},
            {"type": "text", "text": " and "},
            {"type": "text", "text": "both", "marks": [{"type": "bold"}, {"type": "italic"}]},
            {"type": "text", "text": ", "},
            {"type": "text", "text": "old", "marks": [{"type": "strike"}]},
            {"type": "text", "text": ", "},
            {"type": "text", "text": "a site", "marks": [{"type": "link", "attrs": {"href": "https://example.com"}}]},
            {"type": "text", "text": ", "},
            {"type": "text", "text": "npm test", "marks": [{"type": "code"}]},
            {"type": "text", "text": " and 2*3 [x]."},
        ]},
        {"type": "bulletList", "content": [
            {"type": "listItem", "content": [
                {"type": "paragraph", "content": [{"type": "text", "text": "One"}]},
                {"type": "bulletList", "content": [{"type": "listItem", "content": [
                    {"type": "paragraph", "content": [{"type": "text", "text": "Nested"}]}]}]},
            ]},
        ]},
        {"type": "orderedList", "attrs": {"start": 3}, "content": [
            {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Third"}]}]}]},
        {"type": "taskList", "content": [
            {"type": "taskItem", "attrs": {"checked": True}, "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Done"}]}]},
            {"type": "taskItem", "attrs": {"checked": False}, "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Todo"}]}]},
        ]},
        {"type": "blockquote", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Quoted"}]}]},
        {"type": "codeBlock", "attrs": {"language": "python"}, "content": [{"type": "text", "text": "print('*hi*')"}]},
        {"type": "horizontalRule"},
        {"type": "table", "content": [
            {"type": "tableRow", "content": [
                {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Name"}]}]},
                {"type": "tableHeader", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Note"}]}]}]},
            {"type": "tableRow", "content": [
                {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Ada"}]}]},
                {"type": "tableCell", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "a | b"}]}]}]},
        ]},
        {"type": "paragraph", "content": [{"type": "text", "text": "# not a heading"}]},
    ],
}

EXPECTED_MARKDOWN = """# Plan

Some **bold** and ***both***, ~~old~~, [a site](https://example.com), `npm test` and 2\\*3 \\[x\\].

- One
  - Nested

3. Third

- [x] Done
- [ ] Todo

> Quoted

```python
print('*hi*')
```

---

| Name | Note |
| --- | --- |
| Ada | a \\| b |

\\# not a heading
"""


def test_markdown_export_serializes_every_supported_structure():
    assert to_markdown(RICH) == EXPECTED_MARKDOWN


def test_text_export_is_readable_plain_text():
    out = to_text(RICH)
    assert out.startswith("Plan\n\nSome bold and both, old, a site, npm test and 2*3 [x].\n\n")
    assert "• One\n    • Nested" in out
    assert "3. Third" in out
    assert "[x] Done\n[ ] Todo" in out
    assert "print('*hi*')" in out
    assert "Name\tNote\nAda\ta | b" in out
    assert "**" not in out and "](" not in out  # no Markdown syntax in plain text


# ---- Permission levels ---------------------------------------------------------------------------


@pytest.fixture
def carol(client) -> dict[str, str]:
    token = register(client, email="carol@example.com", name="Carol")["access_token"]
    client.cookies.clear()
    return auth_header(token)


@pytest.fixture
def doc(client, alice) -> dict:
    res = client.post("/api/documents", json={"title": "Q4: plan “final”", "content": RICH}, headers=alice)
    assert res.status_code == 201
    return res.json()


def share(client, owner, doc_id, email, permission, can_download=False):
    res = client.post(
        f"/api/documents/{doc_id}/shares",
        json={"email": email, "permission": permission, "can_download": can_download},
        headers=owner,
    )
    assert res.status_code == 201, res.text
    return res.json()


def export(client, headers, doc_id, fmt="markdown"):
    return client.get(f"/api/documents/{doc_id}/export", params={"format": fmt}, headers=headers)


def test_three_permission_levels_are_stored_and_reported(client, alice, bob, carol, doc):
    viewer = share(client, alice, doc["id"], "bob@example.com", "viewer")
    downloader = share(client, alice, doc["id"], "carol@example.com", "viewer", can_download=True)
    assert (viewer["permission"], viewer["can_download"]) == ("viewer", False)
    assert (downloader["permission"], downloader["can_download"]) == ("viewer", True)

    assert client.get(f"/api/documents/{doc['id']}", headers=bob).json()["can_download"] is False
    assert client.get(f"/api/documents/{doc['id']}", headers=carol).json()["can_download"] is True
    assert client.get(f"/api/documents/{doc['id']}", headers=alice).json()["can_download"] is True
    shared = client.get("/api/documents/shared-with-me", headers=carol).json()
    assert shared[0]["can_download"] is True


def test_editors_always_have_download(client, alice, bob, doc):
    # Even if a client sends can_download=false for an editor, editors can download.
    res = share(client, alice, doc["id"], "bob@example.com", "editor", can_download=False)
    assert res["can_download"] is True
    assert export(client, bob, doc["id"]).status_code == 200


def test_viewer_without_download_cannot_export_or_copy(client, alice, bob, doc):
    share(client, alice, doc["id"], "bob@example.com", "viewer")
    for fmt in ("markdown", "text"):
        res = export(client, bob, doc["id"], fmt)
        assert res.status_code == 403
        assert "hasn't allowed downloads" in res.json()["detail"]
    assert client.post(f"/api/documents/{doc['id']}/copy", headers=bob).status_code == 403
    # ...but can still read it
    assert client.get(f"/api/documents/{doc['id']}", headers=bob).status_code == 200


def test_viewer_with_download_can_export_and_copy_but_not_edit(client, alice, bob, doc):
    share(client, alice, doc["id"], "bob@example.com", "viewer", can_download=True)
    assert export(client, bob, doc["id"]).status_code == 200
    assert client.post(f"/api/documents/{doc['id']}/copy", headers=bob).status_code == 201
    assert client.patch(f"/api/documents/{doc['id']}", json={"content": RICH}, headers=bob).status_code == 403


def test_export_requires_access_and_authentication(client, alice, carol, doc):
    assert export(client, carol, doc["id"]).status_code == 404  # no share at all
    assert client.get(f"/api/documents/{doc['id']}/export").status_code == 401
    assert export(client, alice, doc["id"], "pdf").status_code == 422  # unsupported format


def test_export_response_is_a_named_attachment(client, alice, doc):
    md = export(client, alice, doc["id"])
    assert md.status_code == 200
    assert md.headers["content-type"].startswith("text/markdown")
    disposition = md.headers["content-disposition"]
    assert disposition.startswith("attachment;")
    assert 'filename="Q4 plan _final_.md"' in disposition  # ASCII fallback, unsafe chars removed
    assert "filename*=UTF-8''Q4%20plan%20%E2%80%9Cfinal%E2%80%9D.md" in disposition
    assert md.text == EXPECTED_MARKDOWN

    txt = export(client, alice, doc["id"], "text")
    assert txt.headers["content-type"].startswith("text/plain")
    assert txt.headers["content-disposition"].endswith(".txt")


def test_owner_can_change_download_permission_and_downgrade_resets_it(client, alice, bob, doc):
    share(client, alice, doc["id"], "bob@example.com", "viewer")
    bob_id = client.get("/api/auth/me", headers=bob).json()["id"]
    url = f"/api/documents/{doc['id']}/shares/{bob_id}"

    assert client.patch(url, json={"can_download": True}, headers=alice).json()["can_download"] is True
    assert export(client, bob, doc["id"]).status_code == 200
    assert client.patch(url, json={"can_download": False}, headers=alice).json()["can_download"] is False
    assert export(client, bob, doc["id"]).status_code == 403  # takes effect immediately

    client.patch(url, json={"permission": "editor"}, headers=alice)
    downgraded = client.patch(url, json={"permission": "viewer"}, headers=alice).json()
    assert downgraded["can_download"] is False  # editor-era download right is not kept
    assert client.patch(url, json={}, headers=alice).status_code == 422
    # Only the owner can change it
    assert client.patch(url, json={"can_download": True}, headers=bob).status_code == 403


# ---- Copy ------------------------------------------------------------------------------------------


def test_copy_creates_private_document_owned_by_requester(client, alice, bob, doc):
    share(client, alice, doc["id"], "bob@example.com", "viewer", can_download=True)
    res = client.post(f"/api/documents/{doc['id']}/copy", headers=bob)
    assert res.status_code == 201
    copy = res.json()
    assert copy["id"] != doc["id"]
    assert copy["title"] == "Copy of Q4: plan “final”"
    assert copy["content"] == RICH
    assert copy["role"] == "owner"
    assert copy["owner"]["email"] == "bob@example.com"

    # The copy is Bob's own document, not shared with Alice; the original is untouched.
    assert copy["id"] in [d["id"] for d in client.get("/api/documents", headers=bob).json()]
    assert client.get(f"/api/documents/{copy['id']}", headers=alice).status_code == 404
    assert client.get(f"/api/documents/{copy['id']}/shares", headers=bob).json() == []
    client.patch(f"/api/documents/{copy['id']}", json={"content": {"type": "doc", "content": []}}, headers=bob)
    assert client.get(f"/api/documents/{doc['id']}", headers=alice).json()["content"] == RICH


def test_copy_title_is_truncated_to_the_limit(client, alice):
    long = client.post("/api/documents", json={"title": "x" * 200}, headers=alice).json()
    copy = client.post(f"/api/documents/{long['id']}/copy", headers=alice).json()
    assert len(copy["title"]) == 200


# ---- Migration -------------------------------------------------------------------------------------


def test_migration_adds_can_download_to_an_existing_shares_table(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as conn:  # the Phase 4 schema, with an existing share
        conn.execute(text(
            "CREATE TABLE document_shares (id INTEGER PRIMARY KEY, document_id VARCHAR(36), user_id INTEGER, "
            "permission VARCHAR(10), created_at DATETIME)"
        ))
        conn.execute(text("INSERT INTO document_shares VALUES (1, 'd1', 2, 'viewer', '2026-01-01')"))

    assert run_migrations(engine) == ["document_shares.can_download"]
    assert "can_download" in {c["name"] for c in inspect(engine).get_columns("document_shares")}
    with engine.connect() as conn:
        assert conn.execute(text("SELECT can_download FROM document_shares")).scalar() in (0, False)

    assert run_migrations(engine) == []  # idempotent
