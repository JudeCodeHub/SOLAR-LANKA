"""Private files stay outside public paths with opaque IDs and narrow permissions."""

from pathlib import Path

import pytest

from app.core.config import BACKEND_DIR
from app.core.media_policy import AssetCategory
from app.core.private_storage import DEFAULT_PRIVATE_ROOT, LocalPrivateStorage

PNG = b"\x89PNG\r\n\x1a\n" + b"private evidence"


def test_local_private_storage_keeps_files_private(tmp_path: Path) -> None:
    storage = LocalPrivateStorage(tmp_path / "private", environment="test")
    file_id = storage.save(
        category=AssetCategory.INSTALLATION_EVIDENCE,
        content=PNG,
        mime_type="image/png",
    )
    path = storage.root / file_id
    assert len(file_id) == 32
    assert path.read_bytes() == PNG
    assert storage.read(file_id) == PNG
    assert path.stat().st_mode & 0o077 == 0
    assert storage.root.stat().st_mode & 0o077 == 0
    assert not DEFAULT_PRIVATE_ROOT.resolve().is_relative_to(
        (BACKEND_DIR.parent / "frontend" / "public").resolve()
    )
    storage.delete(file_id)
    assert not path.exists()


def test_public_categories_and_spoofed_content_are_rejected(tmp_path: Path) -> None:
    storage = LocalPrivateStorage(tmp_path / "private", environment="test")
    with pytest.raises(ValueError):
        storage.save(category=AssetCategory.PRODUCT_IMAGE, content=PNG, mime_type="image/png")
    with pytest.raises(ValueError):
        storage.save(
            category=AssetCategory.QUOTATION_DOCUMENT,
            content=b"not a PDF",
            mime_type="application/pdf",
        )
    assert list(storage.root.iterdir()) == []


def test_path_traversal_and_public_storage_root_are_rejected(tmp_path: Path) -> None:
    storage = LocalPrivateStorage(tmp_path / "private", environment="test")
    with pytest.raises(ValueError):
        storage.read("../public/file")
    with pytest.raises(ValueError):
        storage.delete("not-a-file-id")
    with pytest.raises(ValueError):
        LocalPrivateStorage(
            BACKEND_DIR.parent / "frontend" / "public" / "private", environment="test"
        )


def test_symlinked_root_is_rejected(tmp_path: Path) -> None:
    target = tmp_path / "target"
    target.mkdir()
    link = tmp_path / "alias"
    link.symlink_to(target, target_is_directory=True)
    with pytest.raises(ValueError):
        LocalPrivateStorage(link, environment="test")


def test_production_cannot_use_local_private_storage(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError):
        LocalPrivateStorage(tmp_path / "private", environment="production")
    assert not (tmp_path / "private").exists()
