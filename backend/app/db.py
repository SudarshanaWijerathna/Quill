from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings

settings = get_settings()

# SQLite needs check_same_thread=False because FastAPI may use a session across threads.
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

# In-memory SQLite (used by tests) must share one connection, or each session sees an empty DB.
in_memory = settings.database_url in ("sqlite://", "sqlite:///:memory:")
engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    **({"poolclass": StaticPool} if in_memory else {}),
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

if settings.database_url.startswith("sqlite"):
    # SQLite ignores foreign keys (and ON DELETE CASCADE) unless enabled per connection.
    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
