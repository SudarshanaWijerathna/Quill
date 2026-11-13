"""Collaborator management. Every endpoint here is owner-only (enforced via `require_role`)."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.access import MANAGE, require_role
from app.auth import get_current_user
from app.db import get_db
from app.models import DocumentShare, User
from app.schemas import ShareCreate, ShareOut, ShareUpdate

router = APIRouter(prefix="/documents/{document_id}/shares", tags=["sharing"])


def _get_share(db: Session, document_id: str, user_id: int) -> DocumentShare:
    share = db.scalar(
        select(DocumentShare)
        .where(DocumentShare.document_id == document_id, DocumentShare.user_id == user_id)
        .options(selectinload(DocumentShare.user))
    )
    if share is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This user does not have access")
    return share


@router.get("", response_model=list[ShareOut])
def list_shares(
    document_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> list[DocumentShare]:
    require_role(document_id, db, user, MANAGE, "manage sharing for")
    return list(
        db.scalars(
            select(DocumentShare)
            .where(DocumentShare.document_id == document_id)
            .options(selectinload(DocumentShare.user))
            .order_by(DocumentShare.created_at)
        )
    )


@router.post("", response_model=ShareOut, status_code=status.HTTP_201_CREATED)
def create_share(
    document_id: str,
    data: ShareCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentShare:
    require_role(document_id, db, user, MANAGE, "manage sharing for")

    if data.email == user.email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You already own this document")
    recipient = db.scalar(select(User).where(User.email == data.email))
    if recipient is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "No Quill account uses this email. Ask them to sign up first."
        )

    existing = db.scalar(
        select(DocumentShare.id).where(
            DocumentShare.document_id == document_id, DocumentShare.user_id == recipient.id
        )
    )
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"{recipient.name} already has access. Change their permission in the list below.",
        )

    share = DocumentShare(
        document_id=document_id,
        user_id=recipient.id,
        permission=data.permission,
        can_download=data.permission == "editor" or data.can_download,
    )
    db.add(share)
    try:
        db.commit()
    except IntegrityError:  # concurrent duplicate request hit the unique constraint
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, f"{recipient.name} already has access.")
    db.refresh(share)
    return share


@router.patch("/{user_id}", response_model=ShareOut)
def update_share(
    document_id: str,
    user_id: int,
    data: ShareUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentShare:
    require_role(document_id, db, user, MANAGE, "manage sharing for")
    share = _get_share(db, document_id, user_id)
    if data.permission is not None:
        share.permission = data.permission
    if data.can_download is not None:
        share.can_download = data.can_download
    elif data.permission == "viewer":
        share.can_download = False  # a downgrade doesn't silently keep editor-era download rights
    if share.permission == "editor":
        share.can_download = True  # editors can always download
    db.commit()
    db.refresh(share)
    return share


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_share(
    document_id: str,
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    require_role(document_id, db, user, MANAGE, "manage sharing for")
    db.delete(_get_share(db, document_id, user_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
