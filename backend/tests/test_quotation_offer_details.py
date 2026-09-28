"""Draft details may be incomplete; sending requires explicit valid terms."""

from decimal import Decimal
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.api.schemas.quotation_edit import DraftTermsInput, SentOfferRequired

LINE = {"kind": "charge", "description": "Installation", "quantity": "1", "unit_price": "10.00"}
DETAILS = {
    "capacity_kwp": "5.250",
    "warranty_terms": "Panel warranty: 10 years",
    "exclusions": "Roof repairs excluded",
    "validity_days": 30,
    "notes": "Site visit required",
}


def test_draft_details_and_required_sent_terms():
    draft = DraftTermsInput.model_validate({"lines": [LINE]})
    assert draft.capacity_kwp is None
    with pytest.raises(ValidationError):
        SentOfferRequired.model_validate(SimpleNamespace(**draft.model_dump()))
    completed = DraftTermsInput.model_validate({"lines": [LINE], **DETAILS})
    ready = SentOfferRequired.model_validate(SimpleNamespace(**completed.model_dump()))
    assert ready.capacity_kwp == Decimal("5.250")
    assert ready.validity_days == 30


@pytest.mark.parametrize(
    "change",
    [
        {"capacity_kwp": "0"},
        {"capacity_kwp": 5.25},
        {"warranty_terms": "   "},
        {"exclusions": "  "},
        {"validity_days": 0},
        {"validity_days": 91},
        {"validity_days": "30"},
        {"notes": "x" * 4001},
    ],
)
def test_invalid_offer_details(change):
    with pytest.raises(ValidationError):
        DraftTermsInput.model_validate({"lines": [LINE], **(DETAILS | change)})
