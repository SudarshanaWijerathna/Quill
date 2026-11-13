import enum
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Boolean, CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint, false
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Stores naive UTC and always returns timezone-aware UTC datetimes.

    SQLite drops tzinfo, which would otherwise serialize timestamps without an offset and make
    browsers interpret them as local time.
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect):
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value: datetime | None, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


def empty_doc() -> dict[str, Any]:
    """An empty Tiptap/ProseMirror document."""
    return {"type": "doc", "content": [{"type": "paragraph"}]}


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    documents: Mapped[list["Document"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    shares: Mapped[list["DocumentShare"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Document(Base):
    __tablename__ = "documents"

    # UUIDs keep document URLs unguessable and non-enumerable.
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(200))
    # Tiptap JSON document: JSON text in SQLite, native JSON in Postgres.
    content: Mapped[dict[str, Any]] = mapped_column(JSON, default=empty_doc)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    owner: Mapped[User] = relationship(back_populates="documents")
    shares: Mapped[list["DocumentShare"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )


class SharePermission(str, enum.Enum):
    VIEWER = "viewer"
    EDITOR = "editor"


class DocumentShare(Base):
    """Grants a non-owner user viewer or editor access to a document."""

    __tablename__ = "document_shares"
    __table_args__ = (
        UniqueConstraint("document_id", "user_id", name="uq_document_share_user"),
        CheckConstraint("permission IN ('viewer', 'editor')", name="ck_document_share_permission"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[str] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    permission: Mapped[str] = mapped_column(String(10))
    # Viewers may additionally be allowed to download/copy/print. Editors and owners always can.
    # server_default keeps existing rows (added by app.migrations) at the safe default: no download.
    can_download: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    document: Mapped[Document] = relationship(back_populates="shares")
    user: Mapped[User] = relationship(back_populates="shares")
