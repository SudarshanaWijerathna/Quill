import pytest

from tests.conftest import auth_header, register

CONTENT = {
    "type": "doc",
    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Secret plans"}]}],
}
NEW_CONTENT = {
    "type": "doc",
    "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Edited by collaborator"}]}],
}


@pytest.fixture
def carol(client) -> dict[str, str]:
    token = register(client, email="carol@example.com", name="Carol")["access_token"]
    client.cookies.clear()
    return auth_header(token)


@pytest.fixture
def doc(client, alice) -> dict:
    res = client.post("/api/documents", json={"title": "Plans", "content": CONTENT}, headers=alice)
    assert res.status_code == 201
    return res.json()


def share(client, owner, doc_id, email="bob@example.com", permission="viewer"):
    return client.post(
        f"/api/documents/{doc_id}/shares", json={"email": email, "permission": permission}, headers=owner
    )


# 1. Owner shares with a registered user ------------------------------------------------------


def test_owner_shares_document_by_email(client, alice, bob, doc):
    res = share(client, alice, doc["id"], email="BOB@example.com", permission="editor")
    assert res.status_code == 201
    body = res.json()
    assert body["user"]["email"] == "bob@example.com"
    assert body["user"]["name"] == "Bob"
    assert body["permission"] == "editor"
    assert "password" not in str(body).lower()

    listed = client.get(f"/api/documents/{doc['id']}/shares", headers=alice).json()
    assert [s["user"]["email"] for s in listed] == ["bob@example.com"]


def test_share_validation(client, alice, bob, doc):
    url = f"/api/documents/{doc['id']}/shares"
    assert share(client, alice, doc["id"], email="alice@example.com").status_code == 400  # self
    assert share(client, alice, doc["id"], email="nobody@example.com").status_code == 404  # unknown
    assert client.post(url, json={"email": "not-an-email"}, headers=alice).status_code == 422
    assert client.post(url, json={"email": "bob@example.com", "permission": "owner"}, headers=alice).status_code == 422

    assert share(client, alice, doc["id"]).status_code == 201
    duplicate = share(client, alice, doc["id"], permission="editor")
    assert duplicate.status_code == 409
    # The duplicate attempt did not change the existing permission.
    assert client.get(url, headers=alice).json()[0]["permission"] == "viewer"


# 2. Recipient sees it in "Shared with me" ----------------------------------------------------


def test_shared_with_me_lists_shared_documents_with_role_and_owner(client, alice, bob, doc):
    assert client.get("/api/documents/shared-with-me", headers=bob).json() == []
    share(client, alice, doc["id"])

    shared = client.get("/api/documents/shared-with-me", headers=bob).json()
    assert len(shared) == 1
    assert shared[0]["id"] == doc["id"]
    assert shared[0]["role"] == "viewer"
    assert shared[0]["owner"]["name"] == "Alice"
    assert shared[0]["preview"] == "Secret plans"

    # Shared documents are not mixed into the recipient's own documents, or the owner's shared list.
    assert client.get("/api/documents", headers=bob).json() == []
    assert client.get("/api/documents/shared-with-me", headers=alice).json() == []
    assert client.get("/api/documents", headers=alice).json()[0]["role"] == "owner"


# 3 & 4. Viewer can read but not modify --------------------------------------------------------


def test_viewer_can_read(client, alice, bob, doc):
    share(client, alice, doc["id"], permission="viewer")
    res = client.get(f"/api/documents/{doc['id']}", headers=bob)
    assert res.status_code == 200
    assert res.json()["content"] == CONTENT
    assert res.json()["role"] == "viewer"


def test_viewer_cannot_modify_anything(client, alice, bob, doc):
    share(client, alice, doc["id"], permission="viewer")
    url = f"/api/documents/{doc['id']}"

    assert client.patch(url, json={"content": NEW_CONTENT}, headers=bob).status_code == 403
    assert client.patch(url, json={"title": "Mine now"}, headers=bob).status_code == 403
    assert client.patch(url, json={}, headers=bob).status_code == 403
    assert client.delete(url, headers=bob).status_code == 403
    assert share(client, bob, doc["id"], email="carol@example.com").status_code == 403
    assert client.get(f"{url}/shares", headers=bob).status_code == 403

    unchanged = client.get(url, headers=alice).json()
    assert unchanged["content"] == CONTENT
    assert unchanged["title"] == "Plans"


# 5 & 6. Editor can edit content but not manage the document ----------------------------------


def test_editor_can_modify_content(client, alice, bob, doc):
    share(client, alice, doc["id"], permission="editor")
    url = f"/api/documents/{doc['id']}"
    res = client.patch(url, json={"content": NEW_CONTENT}, headers=bob)
    assert res.status_code == 200
    assert res.json()["role"] == "editor"
    assert client.get(url, headers=alice).json()["content"] == NEW_CONTENT


def test_editor_cannot_rename_delete_or_manage_sharing(client, alice, bob, carol, doc):
    share(client, alice, doc["id"], permission="editor")
    url = f"/api/documents/{doc['id']}"

    assert client.patch(url, json={"title": "Renamed"}, headers=bob).status_code == 403
    # A rename smuggled in with a content edit is rejected as a whole.
    both = client.patch(url, json={"title": "Renamed", "content": NEW_CONTENT}, headers=bob)
    assert both.status_code == 403
    assert client.delete(url, headers=bob).status_code == 403

    assert client.get(f"{url}/shares", headers=bob).status_code == 403
    assert share(client, bob, doc["id"], email="carol@example.com").status_code == 403
    assert client.patch(f"{url}/shares/{_user_id(client, bob)}", json={"permission": "viewer"}, headers=bob).status_code == 403
    assert client.delete(f"{url}/shares/{_user_id(client, bob)}", headers=bob).status_code == 403

    after = client.get(url, headers=alice).json()
    assert after["title"] == "Plans"
    assert after["content"] == CONTENT


# 7. Unrelated users have no access at all ----------------------------------------------------


def test_unrelated_user_cannot_access_shared_document(client, alice, bob, carol, doc):
    share(client, alice, doc["id"], permission="editor")  # shared with Bob only
    url = f"/api/documents/{doc['id']}"
    for method, kwargs in [
        ("get", {}),
        ("patch", {"json": {"content": NEW_CONTENT}}),
        ("delete", {}),
    ]:
        assert getattr(client, method)(url, headers=carol, **kwargs).status_code == 404
    assert client.get(f"{url}/shares", headers=carol).status_code == 404
    assert client.get("/api/documents/shared-with-me", headers=carol).json() == []


def test_share_on_one_document_grants_nothing_on_others(client, alice, bob, doc):
    other = client.post("/api/documents", json={"title": "Other"}, headers=alice).json()
    share(client, alice, doc["id"], permission="editor")
    assert client.get(f"/api/documents/{other['id']}", headers=bob).status_code == 404
    assert client.patch(f"/api/documents/{other['id']}", json={"content": NEW_CONTENT}, headers=bob).status_code == 404


def test_sharing_endpoints_require_authentication(client, alice, doc):
    url = f"/api/documents/{doc['id']}/shares"
    assert client.get(url).status_code == 401
    assert client.post(url, json={"email": "bob@example.com"}).status_code == 401
    assert client.get("/api/documents/shared-with-me").status_code == 401


# 8. Owner changes permissions ------------------------------------------------------------------


def test_owner_can_change_permission(client, alice, bob, doc):
    share(client, alice, doc["id"], permission="viewer")
    url = f"/api/documents/{doc['id']}"
    bob_id = _user_id(client, bob)
    assert client.patch(url, json={"content": NEW_CONTENT}, headers=bob).status_code == 403

    res = client.patch(f"{url}/shares/{bob_id}", json={"permission": "editor"}, headers=alice)
    assert res.status_code == 200
    assert res.json()["permission"] == "editor"
    assert client.patch(url, json={"content": NEW_CONTENT}, headers=bob).status_code == 200

    # And back down to viewer: edit rights are gone on the very next request.
    client.patch(f"{url}/shares/{bob_id}", json={"permission": "viewer"}, headers=alice)
    assert client.patch(url, json={"content": CONTENT}, headers=bob).status_code == 403

    assert client.patch(f"{url}/shares/{bob_id}", json={"permission": "admin"}, headers=alice).status_code == 422
    assert client.patch(f"{url}/shares/999999", json={"permission": "editor"}, headers=alice).status_code == 404


# 9 & 10. Owner revokes access; the revoked user loses it immediately --------------------------


def test_owner_can_revoke_access_and_it_takes_effect_immediately(client, alice, bob, doc):
    share(client, alice, doc["id"], permission="editor")
    url = f"/api/documents/{doc['id']}"
    bob_id = _user_id(client, bob)
    assert client.get(url, headers=bob).status_code == 200

    assert client.delete(f"{url}/shares/{bob_id}", headers=alice).status_code == 204
    assert client.get(f"{url}/shares", headers=alice).json() == []

    # Same (still valid) session token, next request: access is gone.
    assert client.get(url, headers=bob).status_code == 404
    assert client.patch(url, json={"content": NEW_CONTENT}, headers=bob).status_code == 404
    assert client.get("/api/documents/shared-with-me", headers=bob).json() == []

    assert client.delete(f"{url}/shares/{bob_id}", headers=alice).status_code == 404  # already revoked


def test_deleting_a_document_removes_its_shares(client, alice, bob, doc):
    share(client, alice, doc["id"])
    assert client.delete(f"/api/documents/{doc['id']}", headers=alice).status_code == 204
    assert client.get("/api/documents/shared-with-me", headers=bob).json() == []


def _user_id(client, headers) -> int:
    return client.get("/api/auth/me", headers=headers).json()["id"]
