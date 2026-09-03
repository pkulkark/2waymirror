from fastapi.testclient import TestClient

from twowaymirror import __version__
from twowaymirror.main import create_app


def test_health() -> None:
    client = TestClient(create_app())
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": __version__}
