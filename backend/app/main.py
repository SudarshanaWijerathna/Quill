import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.config import get_settings
from app.db import Base, SessionLocal, engine
from app.migrations import run_migrations
from app.routers import auth, documents, health, shares

settings = get_settings()
settings.check_production_safety()
logger = logging.getLogger("quill")


@asynccontextmanager
async def lifespan(_: FastAPI):
    # MVP: create tables on startup instead of running migrations (Alembic is out of scope).
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    if settings.seed_demo_data and settings.environment != "production":
        from app.seed import seed

        with SessionLocal() as db:
            seed(db)
    yield


app = FastAPI(title=settings.app_name, version=settings.version, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    # Consistent JSON error shape; details go to the server log, not the client.
    logger.exception("Unhandled error", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(shares.router, prefix="/api")


# ---- Production: serve the built SPA from the same origin -------------------------------------
# Registered after the API routers, so /api/* always wins. Unknown non-API paths return
# index.html (client-side routing); unknown /api/* paths stay JSON 404s.
if settings.frontend_dist:
    _dist = Path(settings.frontend_dist).resolve()
    if (_dist / "index.html").is_file():
        if (_dist / "assets").is_dir():
            # Hashed filenames, safe to cache long-term.
            app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

        @app.get("/{full_path:path}", include_in_schema=False)
        def spa(full_path: str) -> FileResponse:
            if full_path == "api" or full_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="Not found")
            candidate = (_dist / full_path).resolve()
            if full_path and candidate.is_file() and candidate.is_relative_to(_dist):
                return FileResponse(candidate)  # e.g. /quill.svg
            return FileResponse(_dist / "index.html", headers={"Cache-Control": "no-cache"})
    else:
        logger.warning("FRONTEND_DIST=%s has no index.html; not serving the frontend", _dist)
