from tests.conftest import auth_header, register


def test_register_returns_user_token_and_httponly_cookie(client):
    res = client.post(
        "/api/auth/register",
        json={"email": "Alice@Example.com", "name": " Alice ", "password": "password123"},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["user"]["email"] == "alice@example.com"  # normalized
    assert body["user"]["name"] == "Alice"
    assert "password" not in str(body["user"]).lower()
    assert body["access_token"]

    cookie = res.headers["set-cookie"].lower()
    assert "quill_session=" in cookie and "httponly" in cookie


def test_register_duplicate_email_is_rejected_case_insensitively(client):
    register(client, email="alice@example.com")
    res = client.post(
        "/api/auth/register",
        json={"email": "ALICE@example.com", "name": "Other", "password": "password123"},
    )
    assert res.status_code == 409


def test_register_validates_input(client):
    bad = [
        {"email": "not-an-email", "name": "A", "password": "password123"},
        {"email": "a@example.com", "name": "A", "password": "short"},
        {"email": "a@example.com", "name": "   ", "password": "password123"},
        {"email": "a@example.com", "name": "A", "password": "x" * 73},
    ]
    for payload in bad:
        assert client.post("/api/auth/register", json=payload).status_code == 422, payload


def test_login_success_and_me_via_cookie(client):
    register(client)
    client.cookies.clear()

    res = client.post("/api/auth/login", json={"email": "alice@example.com", "password": "password123"})
    assert res.status_code == 200
    # TestClient keeps the session cookie, so /me works without an Authorization header.
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "alice@example.com"


def test_login_with_bearer_token(client):
    token = register(client)["access_token"]
    client.cookies.clear()
    assert client.get("/api/auth/me", headers=auth_header(token)).status_code == 200


def test_login_invalid_credentials(client):
    register(client)
    wrong_password = client.post(
        "/api/auth/login", json={"email": "alice@example.com", "password": "wrong-password"}
    )
    unknown_email = client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "password123"}
    )
    assert wrong_password.status_code == 401
    assert unknown_email.status_code == 401
    # Same message either way, so the endpoint does not reveal which emails are registered.
    assert wrong_password.json()["detail"] == unknown_email.json()["detail"]


def test_me_requires_authentication(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/auth/me", headers=auth_header("garbage")).status_code == 401


def test_session_probe_is_200_for_anonymous_and_authenticated(client):
    anon = client.get("/api/auth/session")
    assert anon.status_code == 200
    assert anon.json() == {"user": None}

    register(client)  # sets the session cookie on the client
    res = client.get("/api/auth/session")
    assert res.status_code == 200
    assert res.json()["user"]["email"] == "alice@example.com"


def test_session_probe_clears_invalid_cookie(client):
    client.cookies.set("quill_session", "tampered-token")
    res = client.get("/api/auth/session")
    assert res.status_code == 200
    assert res.json() == {"user": None}
    assert 'quill_session=""' in res.headers.get("set-cookie", "")  # expired/cleared


def test_logout_clears_session(client):
    register(client)
    assert client.get("/api/auth/me").status_code == 200
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
