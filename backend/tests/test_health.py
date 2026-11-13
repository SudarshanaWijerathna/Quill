from fastapi.testclient import TestClient

from app.main import app


def test_health_ok():
    with TestClient(app) as client:
        res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"
