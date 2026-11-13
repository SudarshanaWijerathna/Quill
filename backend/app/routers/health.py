from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health(db: Session = Depends(get_db)) -> dict[str, str]:
    """Liveness + database connectivity check."""
    db.execute(text("SELECT 1"))
    return {"status": "ok", "version": get_settings().version, "database": "ok"}
