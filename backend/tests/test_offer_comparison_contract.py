"""Comparison prices do not imply a preferred offer or invented inclusions."""

from uuid import uuid4

from app.api.schemas.offer_comparison import (
    ComparisonInclusions,
    ComparisonOffer,
    OfferComparison,
)


def test_missing_scope_is_explicit_and_price_does_not_rank_offers():
    request_id = uuid4()
    common = {
        "sent_at": "2026-01-01T00:00:00+00:00",
        "valid_until": "2026-01-31T00:00:00+00:00",
        "capacity_kwp": "5.000",
        "warranty_terms": "10 years",
        "exclusions": "Roof repairs",
        "equipment": [],
    }
    expensive = ComparisonOffer(
        quotation_id=uuid4(),
        revision_id=uuid4(),
        company_id=uuid4(),
        total_lkr="900000.00",
        inclusions=ComparisonInclusions(panel_equipment="included", installation_labour="included"),
        **common,
    )
    cheap = ComparisonOffer(
        quotation_id=uuid4(),
        revision_id=uuid4(),
        company_id=uuid4(),
        total_lkr="700000.00",
        inclusions=ComparisonInclusions(),
        **common,
    )
    result = OfferComparison(request_id=request_id, offers=[expensive, cheap]).model_dump(
        mode="json"
    )
    assert [offer["total_lkr"] for offer in result["offers"]] == ["900000.00", "700000.00"]
    assert "panel_equipment" in result["offers"][1]["inclusions"]["not_specified"]
    assert "installation_labour" in result["offers"][1]["inclusions"]["not_specified"]
    assert "panel_equipment" not in result["offers"][0]["inclusions"]["not_specified"]
    assert "recommendation" not in result
    assert "ranking" not in result
    assert "best_offer" not in result


def test_missing_value_remains_distinct_from_zero():
    offer = ComparisonOffer(
        quotation_id=uuid4(),
        revision_id=uuid4(),
        company_id=uuid4(),
        sent_at="2026-01-01T00:00:00+00:00",
        valid_until="2026-01-31T00:00:00+00:00",
        total_lkr=None,
        capacity_kwp=None,
        warranty_terms=None,
        exclusions=None,
        equipment=[],
        inclusions=ComparisonInclusions(),
    )
    assert "total_lkr" in offer.missing_fields
    assert "capacity_kwp" in offer.missing_fields
    assert offer.model_dump(mode="json")["total_lkr"] is None
