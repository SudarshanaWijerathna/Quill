import json
import re
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


# ---- Auth -------------------------------------------------------------------


class UserCreate(BaseModel):
    email: EmailStr
    name: Name
    password: str = Field(min_length=8)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, v: str) -> str:
        # bcrypt only uses the first 72 bytes, and bcrypt>=5 rejects longer input.
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 bytes")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower()


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    created_at: datetime


class AuthResponse(BaseModel):
    # The token is also set as an httpOnly cookie; it is returned here for API clients and tests.
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class SessionResponse(BaseModel):
    user: UserOut | None


# ---- Documents --------------------------------------------------------------


MAX_CONTENT_BYTES = 10 * 1024 * 1024  # serialized Tiptap JSON; imports are capped at 2 MB of text


SAFE_LINK = re.compile(r"^(https?://[^\s]+|mailto:[^\s@]+@[^\s@]+)$", re.IGNORECASE)


def _check_links(node: Any, depth: int = 0) -> None:
    """Reject link marks whose href is not http(s)/mailto (e.g. javascript:, data:).

    The editor also refuses to render such hrefs; this keeps them out of storage entirely, so a
    crafted API request cannot plant a script link for other collaborators.
    """
    if depth > 200:
        raise ValueError("Document is nested too deeply")
    if not isinstance(node, dict):
        return
    for mark in node.get("marks") or []:
        if isinstance(mark, dict) and mark.get("type") == "link":
            href = (mark.get("attrs") or {}).get("href")
            if not isinstance(href, str) or not SAFE_LINK.match(href.strip()):
                raise ValueError("Links must use http, https or mailto")
    for child in node.get("content") or []:
        _check_links(child, depth + 1)


def _validate_content(value: dict[str, Any] | None) -> dict[str, Any] | None:
    if value is None:
        return value
    if value.get("type") != "doc" or not isinstance(value.get("content", []), list):
        raise ValueError("Content must be a Tiptap document ({'type': 'doc', 'content': [...]})")
    if len(json.dumps(value, separators=(",", ":"))) > MAX_CONTENT_BYTES:
        raise ValueError("Document content is too large")
    _check_links(value)
    return value


Content = Annotated[dict[str, Any] | None, AfterValidator(_validate_content)]


class DocumentCreate(BaseModel):
    title: Title = "Untitled document"
    content: Content = None


class DocumentUpdate(BaseModel):
    title: Title | None = None
    content: Content = None


Role = Literal["owner", "editor", "viewer"]
Permission = Literal["viewer", "editor"]


class UserPublic(BaseModel):
    """Another user's identity as shown to collaborators (no private fields)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str


class DocumentSummary(BaseModel):
    """List item: metadata plus a short plain-text preview instead of the full content."""

    id: str
    title: str
    preview: str
    owner_id: int
    owner: UserPublic
    role: Role  # the requesting user's role on this document
    can_download: bool  # whether the requesting user may export/copy/print
    created_at: datetime
    updated_at: datetime


class DocumentOut(BaseModel):
    id: str
    title: str
    content: dict[str, Any]
    owner_id: int
    owner: UserPublic
    role: Role  # the requesting user's role on this document
    can_download: bool  # whether the requesting user may export/copy/print
    created_at: datetime
    updated_at: datetime


# ---- Sharing ----------------------------------------------------------------


class ShareCreate(BaseModel):
    """permission + can_download map to the three UI levels:
    viewer (no download), viewer + download, editor (always includes download)."""

    email: EmailStr
    permission: Permission = "viewer"
    can_download: bool = False

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower()


class ShareUpdate(BaseModel):
    permission: Permission | None = None
    can_download: bool | None = None

    @model_validator(mode="after")
    def at_least_one_field(self) -> "ShareUpdate":
        if self.permission is None and self.can_download is None:
            raise ValueError("Provide permission and/or can_download")
        return self


class ShareOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: UserPublic
    permission: Permission
    can_download: bool  # effective value (always true for editors)
    created_at: datetime

    @model_validator(mode="after")
    def editors_can_download(self) -> "ShareOut":
        if self.permission == "editor":
            self.can_download = True
        return self
