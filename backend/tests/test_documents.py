from datetime import datetime, timezone

import pytest

from app.db import SessionLocal
from app.models import Document

TIPTAP_DOC = {
    "type": "doc",
    "content": [
        {"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Hello"}]},
        {"type": "paragraph", "content": [{"type": "text", "text": "World"}]},
    ],
}


def create(client, headers, **payload):
    res = client.post("/api/documents", json=payload, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def test_create_document_with_defaults(client, alice):
    doc = create(client, alice)
    assert doc["title"] == "Untitled document"
    assert doc["content"] == {"type": "doc", "content": [{"type": "paragraph"}]}
    assert doc["created_at"].endswith(("Z", "+00:00"))  # timestamps are timezone-aware UTC


def test_create_and_get_document_with_tiptap_content(client, alice):
    doc = create(client, alice, title="Notes", content=TIPTAP_DOC)
    res = client.get(f"/api/documents/{doc['id']}", headers=alice)
    assert res.status_code == 200
    assert res.json()["content"] == TIPTAP_DOC


def test_list_returns_only_own_documents_newest_first(client, alice, bob):
    first = create(client, alice, title="First")
    second = create(client, alice, title="Second", content=TIPTAP_DOC)
    create(client, bob, title="Bob's doc")

    # Back-to-back inserts can share a timestamp (coarse clock resolution on Windows), so set
    # explicit times to test the ordering deterministically.
    with SessionLocal() as db:
        db.get(Document, first["id"]).updated_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
        db.get(Document, second["id"]).updated_at = datetime(2026, 1, 2, tzinfo=timezone.utc)
        db.commit()

    res = client.get("/api/documents", headers=alice)
    assert res.status_code == 200
    docs = res.json()
    assert [d["id"] for d in docs] == [second["id"], first["id"]]
    assert docs[0]["preview"] == "Hello World"
    assert "content" not in docs[0]  # list returns summaries only


def test_rename_and_update_content(client, alice):
    doc = create(client, alice)
    res = client.patch(f"/api/documents/{doc['id']}", json={"title": "  Renamed  "}, headers=alice)
    assert res.status_code == 200
    assert res.json()["title"] == "Renamed"

    res = client.patch(f"/api/documents/{doc['id']}", json={"content": TIPTAP_DOC}, headers=alice)
    assert res.json()["content"] == TIPTAP_DOC
    assert res.json()["title"] == "Renamed"  # untouched fields are preserved
    assert res.json()["updated_at"] >= doc["updated_at"]


def test_update_rejects_empty_title(client, alice):
    doc = create(client, alice)
    res = client.patch(f"/api/documents/{doc['id']}", json={"title": "   "}, headers=alice)
    assert res.status_code == 422


def test_content_must_be_a_tiptap_document(client, alice):
    for bad in [{"type": "paragraph"}, {"html": "<p>hi</p>"}, {"type": "doc", "content": "text"}]:
        assert client.post("/api/documents", json={"content": bad}, headers=alice).status_code == 422
    doc = create(client, alice)
    res = client.patch(f"/api/documents/{doc['id']}", json={"content": {"type": "p"}}, headers=alice)
    assert res.status_code == 422


def _doc_with_link(href):
    return {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "click", "marks": [{"type": "link", "attrs": {"href": href}}]}],
            }
        ],
    }


@pytest.mark.parametrize(
    "href",
    ["javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,<script>x</script>", "vbscript:x", "file:///etc", "", None],
)
def test_unsafe_link_hrefs_are_rejected(client, alice, href):
    res = client.post("/api/documents", json={"content": _doc_with_link(href)}, headers=alice)
    assert res.status_code == 422
    assert "Links must use http, https or mailto" in res.text


def test_unsafe_links_rejected_on_update_even_nested(client, alice):
    doc = create(client, alice)
    nested = {"type": "doc", "content": [{"type": "table", "content": [{"type": "tableRow", "content": [
        {"type": "tableCell", "content": _doc_with_link("javascript:alert(1)")["content"]}]}]}]}
    res = client.patch(f"/api/documents/{doc['id']}", json={"content": nested}, headers=alice)
    assert res.status_code == 422


@pytest.mark.parametrize("href", ["https://example.com/a?b=1", "http://localhost:5173", "mailto:a@example.com"])
def test_safe_link_hrefs_are_accepted(client, alice, href):
    assert client.post("/api/documents", json={"content": _doc_with_link(href)}, headers=alice).status_code == 201


RICH_DOC = {
    "type": "doc",
    "content": [
        {"type": "table", "content": [
            {"type": "tableRow", "content": [
                {"type": "tableHeader", "attrs": {"colspan": 1, "rowspan": 1, "colwidth": None},
                 "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Head"}]}]}]},
            {"type": "tableRow", "content": [
                {"type": "tableCell", "attrs": {"colspan": 1, "rowspan": 1, "colwidth": None},
                 "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Cell"}]}]}]},
        ]},
        {"type": "codeBlock", "attrs": {"language": "python"}, "content": [{"type": "text", "text": "print(1)"}]},
        {"type": "taskList", "content": [
            {"type": "taskItem", "attrs": {"checked": True},
             "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Done"}]}]}]},
        {"type": "blockquote", "content": [{"type": "paragraph", "content": [
            {"type": "text", "text": "Quote", "marks": [{"type": "strike"}]}]}]},
        {"type": "horizontalRule"},
    ],
}


def test_rich_content_round_trips_exactly_and_previews_include_its_text(client, alice):
    doc = create(client, alice, content=RICH_DOC)
    assert client.get(f"/api/documents/{doc['id']}", headers=alice).json()["content"] == RICH_DOC
    preview = client.get("/api/documents", headers=alice).json()[0]["preview"]
    assert preview == "Head Cell print(1) Done Quote"


def test_oversized_content_is_rejected(client, alice):
    from app.schemas import MAX_CONTENT_BYTES

    huge = {
        "type": "doc",
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": "x" * MAX_CONTENT_BYTES}]}],
    }
    res = client.post("/api/documents", json={"content": huge}, headers=alice)
    assert res.status_code == 422
    assert "too large" in res.text


def test_imported_document_belongs_to_creator_only(client, alice, bob):
    # The frontend import flow creates documents through POST /documents with converted content.
    imported = create(client, alice, title="notes", content=TIPTAP_DOC)
    assert imported["owner_id"] == client.get("/api/auth/me", headers=alice).json()["id"]
    assert [d["id"] for d in client.get("/api/documents", headers=alice).json()] == [imported["id"]]
    assert client.get("/api/documents", headers=bob).json() == []
    assert client.get(f"/api/documents/{imported['id']}", headers=bob).status_code == 404


def test_delete_document(client, alice):
    doc = create(client, alice)
    assert client.delete(f"/api/documents/{doc['id']}", headers=alice).status_code == 204
    assert client.get(f"/api/documents/{doc['id']}", headers=alice).status_code == 404
    assert client.get("/api/documents", headers=alice).json() == []


def test_missing_document_returns_404(client, alice):
    assert client.get("/api/documents/does-not-exist", headers=alice).status_code == 404


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("get", "/api/documents", None),
        ("post", "/api/documents", {"title": "x"}),
        ("get", "/api/documents/some-id", None),
        ("patch", "/api/documents/some-id", {"title": "x"}),
        ("delete", "/api/documents/some-id", None),
    ],
)
def test_document_endpoints_require_authentication(client, method, path, body):
    kwargs = {"json": body} if body is not None else {}
    assert getattr(client, method)(path, **kwargs).status_code == 401


def test_non_owner_cannot_read_update_or_delete(client, alice, bob):
    doc = create(client, alice, title="Private", content=TIPTAP_DOC)
    url = f"/api/documents/{doc['id']}"

    # 404 rather than 403 so other users cannot even confirm the document exists.
    assert client.get(url, headers=bob).status_code == 404
    assert client.patch(url, json={"title": "Hacked"}, headers=bob).status_code == 404
    assert client.delete(url, headers=bob).status_code == 404

    # The owner's document is unchanged.
    res = client.get(url, headers=alice)
    assert res.status_code == 200
    assert res.json()["title"] == "Private"
