from typing import Any

from urllib.parse import quote

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.access import EDIT_CONTENT, MANAGE, READ, Role, require_download, require_role
from app.auth import get_current_user
from app.db import get_db
from app.export import to_markdown, to_text
from app.models import Document, DocumentShare, User, empty_doc
from app.schemas import DocumentCreate, DocumentOut, DocumentSummary, DocumentUpdate, UserPublic

router = APIRouter(prefix="/documents", tags=["documents"])

PREVIEW_LENGTH = 160
# Block nodes whose text is separated by a space in previews.
BLOCK_TYPES = {
    "paragraph", "heading", "listItem", "taskItem", "codeBlock", "tableCell", "tableHeader", "blockquote",
}


def extract_text(node: Any, limit: int = PREVIEW_LENGTH) -> str:
    """Flatten Tiptap JSON into a short plain-text preview."""
    parts: list[str] = []

    def walk(n: Any) -> None:
        if sum(len(p) for p in parts) >= limit or not isinstance(n, dict):
            return
        if isinstance(n.get("text"), str):
            parts.append(n["text"])
        for child in n.get("content") or []:
            walk(child)
        if n.get("type") in BLOCK_TYPES:
            parts.append(" ")

    walk(node)
    text = " ".join("".join(parts).split())
    return text[:limit]


def to_summary(doc: Document, role: Role, can_download: bool = True) -> DocumentSummary:
    return DocumentSummary(
        id=doc.id,
        title=doc.title,
        preview=extract_text(doc.content),
        owner_id=doc.owner_id,
        owner=UserPublic.model_validate(doc.owner),
        role=role,
        can_download=can_download,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


def to_out(doc: Document, role: Role, can_download: bool = True) -> DocumentOut:
    return DocumentOut(
        id=doc.id,
        title=doc.title,
        content=doc.content,
        owner_id=doc.owner_id,
        owner=UserPublic.model_validate(doc.owner),
        role=role,
        can_download=can_download,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


@router.get("", response_model=list[DocumentSummary])
def list_documents(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[DocumentSummary]:
    """Documents owned by the current user (shared documents are listed separately)."""
    docs = db.scalars(
        select(Document)
        .where(Document.owner_id == user.id)
        .options(selectinload(Document.owner))
        .order_by(Document.updated_at.desc(), Document.created_at.desc())
    ).all()
    return [to_summary(d, "owner") for d in docs]


# Declared before "/{document_id}" so "shared-with-me" is not captured as a document id.
@router.get("/shared-with-me", response_model=list[DocumentSummary])
def list_shared_with_me(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[DocumentSummary]:
    rows = db.execute(
        select(Document, DocumentShare.permission, DocumentShare.can_download)
        .join(DocumentShare, DocumentShare.document_id == Document.id)
        .where(DocumentShare.user_id == user.id)
        .options(selectinload(Document.owner))
        .order_by(Document.updated_at.desc(), Document.created_at.desc())
    ).all()
    return [to_summary(doc, perm, perm == "editor" or bool(dl)) for doc, perm, dl in rows]


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_document(
    data: DocumentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> DocumentOut:
    doc = Document(title=data.title, content=data.content or empty_doc(), owner_id=user.id)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return to_out(doc, "owner")


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> DocumentOut:
    access = require_role(document_id, db, user, READ, "view")
    return to_out(access.document, access.role, access.can_download)


@router.patch("/{document_id}", response_model=DocumentOut)
def update_document(
    document_id: str,
    data: DocumentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentOut:
    # Renaming is owner-only; editing content is allowed for owners and editors. Viewers are
    # rejected either way (even for an empty patch).
    if data.title is not None:
        access = require_role(document_id, db, user, MANAGE, "rename")
    else:
        access = require_role(document_id, db, user, EDIT_CONTENT, "edit")

    doc = access.document
    if data.title is not None:
        doc.title = data.title
    if data.content is not None:
        doc.content = data.content
    db.commit()
    db.refresh(doc)
    return to_out(doc, access.role, access.can_download)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> Response:
    access = require_role(document_id, db, user, MANAGE, "delete")
    db.delete(access.document)  # shares are removed via cascade
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


EXPORT_FORMATS = {
    "markdown": ("md", "text/markdown; charset=utf-8", to_markdown),
    "text": ("txt", "text/plain; charset=utf-8", to_text),
}


UNSAFE_FILENAME_CHARS = set('\\/:*?"<>|\r\n\t')


def _download_filename(title: str, extension: str) -> tuple[str, str]:
    """ASCII fallback and RFC 5987 UTF-8 filename for Content-Disposition."""
    cleaned = "".join(c for c in title if c not in UNSAFE_FILENAME_CHARS).strip() or "document"
    ascii_name = "".join(c if 32 <= ord(c) < 127 else "_" for c in cleaned)[:120]
    return f"{ascii_name}.{extension}", quote(f"{cleaned[:120]}.{extension}")


@router.get("/{document_id}/export")
def export_document(
    document_id: str,
    format: str = Query("markdown", pattern="^(markdown|text)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    """Download as Markdown or plain text. Requires download permission (owner, editor, or a
    viewer whose share allows downloads)."""
    access = require_download(document_id, db, user)
    extension, media_type, serialize = EXPORT_FORMATS[format]
    ascii_name, utf8_name = _download_filename(access.document.title, extension)
    return Response(
        content=serialize(access.document.content),
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{utf8_name}",
            "Cache-Control": "no-store",
        },
    )


@router.post("/{document_id}/copy", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def copy_document(
    document_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> DocumentOut:
    """Make a copy owned by the current user. Copying is a form of download, so it needs the same
    permission. Shares are not copied: the copy is private to its new owner."""
    access = require_download(document_id, db, user)
    source = access.document
    copy = Document(
        title=f"Copy of {source.title}"[:200],
        content=copy_json(source.content),
        owner_id=user.id,
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return to_out(copy, "owner")


def copy_json(value: Any) -> Any:
    """Deep copy of JSON-compatible data (avoids sharing mutable state between rows)."""
    import copy as _copy

    return _copy.deepcopy(value)
