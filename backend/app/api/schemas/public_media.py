"""Public, verified media references only."""

from typing import Literal

from pydantic import BaseModel, HttpUrl

from app.core.value_types import EntityId


class PublicMedia(BaseModel):
    id: EntityId
    category: Literal["product_image", "product_datasheet", "company_logo"]
    url: HttpUrl
