"""Centralized document authorization.

Every document and sharing endpoint resolves access through `require_role`, so the permission
rules live in one place:

| Action                               | owner | editor | viewer |
| ------------------------------------ | :---: | :----: | :----: |
| Read document                        |   ✓   |   ✓    |   ✓    |
| Edit content                         |   ✓   |   ✓    |        |
| Rename, delete, manage collaborators |   ✓   |        |        |
| Download, export, copy, print        |   ✓   |   ✓    | if share.can_download |

Users with no access get 404 (the document's existence is not revealed). Users who can see the
document but lack the required role get 403.
"""

from dataclasses import dataclass
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Document, DocumentShare, User

Role = Literal["owner", "editor", "viewer"]

READ: tuple[Role, ...] = ("owner", "editor", "viewer")
EDIT_CONTENT: tuple[Role, ...] = ("owner", "editor")
MANAGE: tuple[Role, ...] = ("owner",)


@dataclass
class DocumentAccess:
    document: Document
    role: Role
    can_download: bool


def get_document_access(document_id: str, db: Session, user: User) -> DocumentAccess | None:
    """Return the user's access to a document, or None if they have none."""
    doc = db.get(Document, document_id)
    if doc is None:
        return None
    if doc.owner_id == user.id:
        return DocumentAccess(doc, "owner", True)
    share = db.execute(
        select(DocumentShare.permission, DocumentShare.can_download).where(
            DocumentShare.document_id == document_id, DocumentShare.user_id == user.id
        )
    ).first()
    if share is None:
        return None
    permission, can_download = share
    return DocumentAccess(doc, permission, permission == "editor" or bool(can_download))  # type: ignore[arg-type]


def require_role(
    document_id: str, db: Session, user: User, allowed: tuple[Role, ...], action: str
) -> DocumentAccess:
    access = get_document_access(document_id, db, user)
    if access is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    if access.role not in allowed:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, f"You don't have permission to {action} this document"
        )
    return access


def require_download(document_id: str, db: Session, user: User) -> DocumentAccess:
    """Download, export and copy: owners, editors, and viewers whose share allows downloads."""
    access = require_role(document_id, db, user, READ, "download")
    if not access.can_download:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "The owner hasn't allowed downloads for this document"
        )
    return access
