"""FastAPI application factory."""

from fastapi import FastAPI

from twowaymirror import __version__


def create_app() -> FastAPI:
    app = FastAPI(title="2WayMirror API", version=__version__, docs_url=None, redoc_url=None)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    return app


app = create_app()
