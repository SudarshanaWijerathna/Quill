"""Minimal, idempotent schema migrations run at startup.

The project creates tables with `Base.metadata.create_all` (no Alembic, an MVP trade-off), which
creates missing *tables* but never alters existing ones. Columns added later are applied here.
Each step checks the live schema first, so running it repeatedly is safe.
"""

import logging

from sqlalchemy import Engine, inspect, text

logger = logging.getLogger("quill.migrations")


def run_migrations(engine: Engine) -> list[str]:
    applied: list[str] = []
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if "document_shares" in tables:
        columns = {c["name"] for c in inspector.get_columns("document_shares")}
        if "can_download" not in columns:
            # Existing shares get the safe default (viewers cannot download).
            with engine.begin() as conn:
                conn.execute(
                    text("ALTER TABLE document_shares ADD COLUMN can_download BOOLEAN NOT NULL DEFAULT FALSE")
                )
            applied.append("document_shares.can_download")

    for step in applied:
        logger.info("Applied migration: %s", step)
    return applied
