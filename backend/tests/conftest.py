import os

# Must be set before the app (and its settings/engine) is imported.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_SECRET"] = "test-secret-key-that-is-long-enough-for-hs256"
os.environ["SEED_DEMO_DATA"] = "false"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def register(client: TestClient, email: str = "alice@example.com", password: str = "password123",
             name: str = "Alice") -> dict:
    res = client.post("/api/auth/register", json={"email": email, "name": name, "password": password})
    assert res.status_code == 201, res.text
    return res.json()


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def alice(client) -> dict[str, str]:
    """Bearer header for a registered user. Cookies are cleared so only the header authenticates."""
    token = register(client)["access_token"]
    client.cookies.clear()
    return auth_header(token)


@pytest.fixture
def bob(client) -> dict[str, str]:
    token = register(client, email="bob@example.com", name="Bob")["access_token"]
    client.cookies.clear()
    return auth_header(token)
