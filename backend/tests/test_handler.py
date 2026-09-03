import json
from typing import Any

from twowaymirror.handler import handler


def _http_api_event(path: str) -> dict[str, Any]:
    return {
        "version": "2.0",
        "routeKey": "$default",
        "rawPath": path,
        "rawQueryString": "",
        "headers": {"host": "example.com"},
        "requestContext": {
            "http": {
                "method": "GET",
                "path": path,
                "protocol": "HTTP/1.1",
                "sourceIp": "127.0.0.1",
            },
            "requestId": "test",
            "stage": "$default",
        },
        "isBase64Encoded": False,
    }


def test_lambda_handler_serves_health() -> None:
    response = handler(_http_api_event("/api/health"), context=None)
    assert response["statusCode"] == 200
    assert json.loads(response["body"])["status"] == "ok"
