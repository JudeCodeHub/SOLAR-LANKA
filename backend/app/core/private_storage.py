"""Local development storage for private documents and evidence.

Public catalogue media uses ImageKit. Private files stay in an ignored backend
folder that FastAPI never mounts. ImageKit can serve private files with signed
URLs, but that requires a separate, verified delivery configuration. For
production, replace this local adapter with private object storage or a fully
configured private-file provider and authorize every download before delivery.
Only opaque IDs leave this adapter; original filenames never choose paths.
"""

import os
import re
from pathlib import Path
from uuid import uuid4

from app.core.config import BACKEND_DIR
from app.core.media_policy import AssetCategory, Visibility, validate_upload_metadata

DEFAULT_PRIVATE_ROOT = BACKEND_DIR / "storage" / "private"
PUBLIC_ROOTS = (
    BACKEND_DIR.parent / "frontend" / "public",
    BACKEND_DIR / "static",
    BACKEND_DIR / "app" / "static",
)


def _matches_mime(content: bytes, mime_type: str) -> bool:
    if mime_type == "application/pdf":
        return content.startswith(b"%PDF-")
    if mime_type == "image/jpeg":
        return content.startswith(b"\xff\xd8\xff")
    if mime_type == "image/png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if mime_type == "image/webp":
        return content.startswith(b"RIFF") and content[8:12] == b"WEBP"
    return False


class LocalPrivateStorage:
    """Private local files; no URL builder or public-serving operation exists."""

    def __init__(self, root: Path = DEFAULT_PRIVATE_ROOT, *, environment: str) -> None:
        if environment not in {"development", "test"}:
            raise RuntimeError("Local private storage is for development and tests only")
        root = Path(root)
        if root.is_symlink():
            raise ValueError("Private storage root cannot be a symlink")
        resolved = root.resolve()
        if any(resolved.is_relative_to(public.resolve()) for public in PUBLIC_ROOTS):
            raise ValueError("Private storage cannot be inside a public directory")
        resolved.mkdir(parents=True, exist_ok=True, mode=0o700)
        resolved.chmod(0o700)
        self.root = resolved

    @staticmethod
    def _name(file_id: str) -> str:
        if re.fullmatch(r"[0-9a-f]{32}", file_id) is None:
            raise ValueError("Invalid private file ID")
        return file_id

    def save(self, *, category: AssetCategory, content: bytes, mime_type: str) -> str:
        if not isinstance(content, bytes):
            raise ValueError("File content must be bytes")
        policy = validate_upload_metadata(category, size_bytes=len(content), mime_type=mime_type)
        if policy.visibility != Visibility.PRIVATE or not _matches_mime(content, mime_type):
            raise ValueError("Unsupported private file")
        file_id = uuid4().hex
        path = self.root / file_id
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())
        except BaseException:
            path.unlink(missing_ok=True)
            raise
        return file_id

    def read(self, file_id: str) -> bytes:
        path = self.root / self._name(file_id)
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(fd, "rb") as stream:
            return stream.read()

    def delete(self, file_id: str) -> None:
        (self.root / self._name(file_id)).unlink()
