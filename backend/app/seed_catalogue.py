"""Insert-only demo catalogue from manufacturer datasheets reviewed 2026-09-27.

Sources establish model identities and stored specifications. Prices and companies
are fictional illustrations, never manufacturer prices or verified seller offers.
"""

from datetime import UTC, datetime
from decimal import Decimal
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.inverter import Inverter
from app.models.panel import Panel
from app.models.product import Product
from app.models.product_offer import ProductOffer
from app.models.product_source import ProductSource

TRINA_RC = "https://static.trinasolar.com/sites/default/files/Datasheet_VertexS_NEG9RC.27_EN_2023_D_web.pdf"
TRINA_R = "https://static.trinasolar.com/sites/default/files/Datasheet_Vertex%20S%2B_NEG9R.28_DE_2024_C_web.pdf"
GOODWE_DNS = (
    "https://en.goodwe.com/Public/Uploads/uploadfile/files/20250609/GW_DNSG3_Datasheet-EN.pdf"
)
GOODWE_ET = "https://en.goodwe.com/Ftp/EN/Downloads/Datasheet/GW_ET%20PLUS%2B_Datasheet-EN.pdf"
GOODWE_XS = "https://en.goodwe.com/xs-g3"

# (model, sourced wattage W, manufacturer datasheet)
PANELS = tuple((f"TSM-{watts} NEG9RC.27", watts, TRINA_RC) for watts in range(415, 446, 5)) + tuple(
    (f"TSM-{watts} NEG9R.28", watts, TRINA_R) for watts in (450, 455, 460)
)
# (model, documented nominal AC output kW if available, MPPT count, category, source)
INVERTERS = (
    ("GW3000-DNS-30", "3", 2, "on_grid", GOODWE_DNS),
    ("GW3600-DNS-30", "3.6", 2, "on_grid", GOODWE_DNS),
    ("GW4200-DNS-30", "4.2", 2, "on_grid", GOODWE_DNS),
    ("GW5000-DNS-30", "5", 2, "on_grid", GOODWE_DNS),
    ("GW6000-DNS-30", "6", 2, "on_grid", GOODWE_DNS),
    ("GW5K-ET", "5", 2, "hybrid", GOODWE_ET),
    ("GW6.5K-ET", "6.5", 2, "hybrid", GOODWE_ET),
    ("GW8K-ET", "8", 2, "hybrid", GOODWE_ET),
    ("GW10K-ET", "10", 2, "hybrid", GOODWE_ET),
    ("GW3000-XS-30", None, 1, None, GOODWE_XS),
)


def _id(kind: str, model: str) -> UUID:
    return uuid5(NAMESPACE_URL, f"solarlanka:demo-catalogue:{kind}:{model}")


def seed_catalogue(session: Session, *, environment: str, company_ids: tuple[UUID, UUID]) -> None:
    if environment not in {"development", "test"}:
        raise ValueError("Demo catalogue is allowed only in development or test")
    reviewed_at = datetime.now(UTC)
    entries = (
        (
            "panel",
            "Trina Solar",
            model,
            {"wattage_w": str(watts)},
            source,
            {"wattage_w": Decimal(watts)},
        )
        for model, watts, source in PANELS
    )
    inverter_entries = (
        (
            "inverter",
            "GoodWe",
            model,
            {"capacity_kw": capacity, "mppt_count": mppt, "category": category}
            if capacity is not None
            else {"mppt_count": mppt},
            source,
            {
                "capacity_kw": Decimal(capacity) if capacity is not None else None,
                "mppt_count": mppt,
                "category": category,
            },
        )
        for model, capacity, mppt, category, source in INVERTERS
    )
    for index, (kind, brand, model, evidence, source, specs) in enumerate(
        (*entries, *inverter_entries)
    ):
        product_id = _id("product", model)
        session.execute(
            insert(Product)
            .values(
                id=product_id,
                kind=kind,
                brand=brand,
                model=model,
                source_url=source,
                verified_at=reviewed_at,
            )
            .on_conflict_do_nothing(index_elements=[Product.id])
        )
        spec_model = Panel if kind == "panel" else Inverter
        session.execute(
            insert(spec_model)
            .values(product_id=product_id, **specs)
            .on_conflict_do_nothing(index_elements=[spec_model.product_id])
        )
        session.execute(
            insert(ProductSource)
            .values(
                id=_id("source", model),
                product_id=product_id,
                source_url=source,
                source_title="Manufacturer product datasheet or product page",
                specifications={"brand": brand, "model": model, **evidence},
                retrieved_at=reviewed_at,
                verified_at=reviewed_at,
            )
            .on_conflict_do_nothing(index_elements=[ProductSource.id])
        )
        company_id = company_ids[index % len(company_ids)]
        # Invented illustration only; no claim of a live seller price or inventory.
        sample_price = Decimal(25000 + index * 1500)
        session.execute(
            insert(ProductOffer)
            .values(
                id=_id("offer", model),
                company_id=company_id,
                product_id=product_id,
                indicative_price=sample_price,
                currency="LKR",
                is_demo_price=True,
                company_claim="Fictional sample offer; not a current quote or stock claim.",
            )
            .on_conflict_do_nothing(constraint="uq_product_offers_company_product")
        )
