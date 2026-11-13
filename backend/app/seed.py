"""Development-only demo data.

Run manually:   python -m app.seed
Or on startup:  SEED_DEMO_DATA=true (ignored when ENVIRONMENT=production)

Idempotent: existing demo users are left untouched.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.config import get_settings
from app.db import Base, SessionLocal, engine
from app.migrations import run_migrations
from app.models import Document, User

DEMO_PASSWORD = "quill-demo-123"

DEMO_USERS = [
    {"email": "alice@example.com", "name": "Alice Carter"},
    {"email": "bob@example.com", "name": "Bob Nguyen"},
]


def _p(text: str) -> dict:
    return {"type": "paragraph", "content": [{"type": "text", "text": text}]}


def _h(text: str, level: int = 1) -> dict:
    return {"type": "heading", "attrs": {"level": level}, "content": [{"type": "text", "text": text}]}


def _bullets(*items: str) -> dict:
    return {"type": "bulletList", "content": [{"type": "listItem", "content": [_p(i)]} for i in items]}


SAMPLE_DOCS: dict[str, list[tuple[str, dict]]] = {
    "alice@example.com": [
        (
            "Q4 Product Roadmap",
            {
                "type": "doc",
                "content": [
                    _h("Q4 Product Roadmap"),
                    _p("Our focus this quarter is collaboration and reliability."),
                    _bullets("Document sharing with roles", "Markdown import", "Faster autosave"),
                ],
            },
        ),
        (
            "Meeting notes — Design sync",
            {
                "type": "doc",
                "content": [
                    _h("Design sync", 2),
                    _p("Agreed on a navy primary accent and a calmer, minimal editor surface."),
                ],
            },
        ),
    ],
    "bob@example.com": [
        (
            "Launch checklist",
            {
                "type": "doc",
                "content": [
                    _h("Launch checklist"),
                    _bullets("Finalize copy", "QA on mobile", "Announce to the team"),
                ],
            },
        ),
    ],
}


def seed(db: Session) -> list[str]:
    created: list[str] = []
    for info in DEMO_USERS:
        if db.scalar(select(User).where(User.email == info["email"])):
            continue
        user = User(email=info["email"], name=info["name"], password_hash=hash_password(DEMO_PASSWORD))
        db.add(user)
        db.flush()
        for title, content in SAMPLE_DOCS.get(info["email"], []):
            db.add(Document(title=title, content=content, owner_id=user.id))
        created.append(info["email"])
    db.commit()
    return created


def main() -> None:
    if get_settings().environment == "production":
        raise SystemExit("Refusing to seed demo data in production.")
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
    with SessionLocal() as db:
        created = seed(db)
    print(f"Seeded demo users: {', '.join(created)}" if created else "Demo users already exist.")
    print(f"Demo password: {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
