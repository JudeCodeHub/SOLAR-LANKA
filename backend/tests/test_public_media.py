"""Public API references include only verified public media for each parent."""

from datetime import UTC, datetime
from uuid import uuid4

from fastapi import Response
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.api.routes import catalogue, companies
from app.api.schemas.catalogue_filters import PanelQuery
from app.api.schemas.companies import DirectoryQuery
from app.api.schemas.public_media import PublicMedia
from app.models.company import Company
from app.models.media_asset import MediaAsset
from app.models.panel import Panel
from app.models.product import Product
from app.models.user import AppUser
from app.services.public_media import public_media_for


def test_public_media_query_filters_visibility_parent_and_category() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    AppUser.__table__.create(engine)
    MediaAsset.__table__.create(engine)
    owner = AppUser(clerk_subject="verified-public-media", role="customer")
    product_id, company_id = uuid4(), uuid4()
    with Session(engine) as session:
        session.add(owner)
        session.flush()
        session.add_all(
            [
                MediaAsset(
                    provider="imagekit",
                    provider_file_id="product-1",
                    owner_user_id=owner.id,
                    category="product_image",
                    parent_kind="product",
                    parent_id=product_id,
                    visibility="public",
                    public_url="https://ik.imagekit.io/test/product.jpg",
                ),
                MediaAsset(
                    provider="imagekit",
                    provider_file_id="logo-1",
                    owner_user_id=owner.id,
                    category="company_logo",
                    parent_kind="company",
                    parent_id=company_id,
                    visibility="public",
                    public_url="https://ik.imagekit.io/test/logo.jpg",
                ),
                MediaAsset(
                    provider="private",
                    provider_file_id="secret-1",
                    owner_user_id=owner.id,
                    category="support_evidence",
                    parent_kind="support_case",
                    parent_id=product_id,
                    visibility="private",
                    public_url=None,
                ),
            ]
        )
        session.commit()
        products = public_media_for(
            session,
            parent_kind="product",
            parent_ids=[product_id],
            categories=("product_image", "product_datasheet"),
        )
        companies_media = public_media_for(
            session,
            parent_kind="company",
            parent_ids=[company_id],
            categories=("company_logo",),
        )
    engine.dispose()
    assert [item.category for item in products[product_id]] == ["product_image"]
    assert [item.category for item in companies_media[company_id]] == ["company_logo"]
    assert "secret-1" not in str(products) + str(companies_media)


def test_product_and_approved_company_responses_include_public_references(monkeypatch) -> None:
    product_id, company_id = uuid4(), uuid4()
    media = PublicMedia(
        id=uuid4(), category="product_image", url="https://ik.imagekit.io/test/product.jpg"
    )
    logo = PublicMedia(
        id=uuid4(), category="company_logo", url="https://ik.imagekit.io/test/logo.jpg"
    )
    product = Product(
        id=product_id,
        kind="panel",
        brand="Test",
        model="P1",
        is_archived=False,
        created_at=datetime.now(UTC),
    )
    panel = Panel(product_id=product_id)
    company = Company(
        id=company_id,
        name="Installer",
        publication_status="approved",
        service_districts=[],
        services=[],
        declared_credentials=[],
    )

    class ProductSession:
        def scalars(self, statement):
            return self

        def one_or_none(self):
            return product

        def get(self, model, id):
            return panel

    monkeypatch.setattr(
        catalogue, "public_media_for", lambda *args, **kwargs: {product_id: [media]}
    )
    detail = catalogue._detail("panel", product_id, ProductSession())
    assert detail.media == [media]

    class ProductListSession:
        def scalar(self, statement):
            return 1

        def scalars(self, statement):
            return [product]

    listing = catalogue._list("panel", ProductListSession(), PanelQuery())
    assert listing.items[0].media == [media]
    assert "support_evidence" not in detail.model_dump_json()

    class CompanySession:
        def scalars(self, statement):
            return self

        def one_or_none(self):
            return company

    monkeypatch.setattr(companies, "public_media_for", lambda *args, **kwargs: {company_id: [logo]})
    public = companies.read_public_company(company_id, CompanySession(), Response())
    assert public.logo == logo

    class CompanyListSession:
        def scalar(self, statement):
            return 1

        def scalars(self, statement):
            return [company]

    public_list = companies.list_public_companies(
        CompanyListSession(), DirectoryQuery(), Response()
    )
    assert public_list.items[0].logo == logo
    assert public_list.total == 1
    assert "support_evidence" not in public.model_dump_json()
