"""Read only verified public ImageKit media for approved public records."""

from collections.abc import Collection
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas.public_media import PublicMedia
from app.models.media_asset import MediaAsset


def public_media_for(
    session: Session,
    *,
    parent_kind: str,
    parent_ids: Collection[UUID],
    categories: tuple[str, ...],
) -> dict[UUID, list[PublicMedia]]:
    if not parent_ids:
        return {}
    assets = session.scalars(
        select(MediaAsset)
        .where(
            MediaAsset.provider == "imagekit",
            MediaAsset.visibility == "public",
            MediaAsset.parent_kind == parent_kind,
            MediaAsset.parent_id.in_(parent_ids),
            MediaAsset.category.in_(categories),
            MediaAsset.public_url.is_not(None),
        )
        .order_by(MediaAsset.created_at, MediaAsset.id)
    )
    result: dict[UUID, list[PublicMedia]] = {}
    for asset in assets:
        result.setdefault(asset.parent_id, []).append(
            PublicMedia(id=asset.id, category=asset.category, url=asset.public_url)
        )
    return result
