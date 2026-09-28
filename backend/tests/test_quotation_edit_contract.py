"""Draft terms reject imprecise or inconsistent charges."""

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.api.schemas.quotation_edit import DraftTermsInput

BASE = {
    "lines": [
        {
            "kind": "equipment",
            "product_id": str(uuid4()),
            "description": "Panel",
            "quantity": "2.000",
            "unit_price": "100.05",
        }
    ],
    "discount_kind": "percent",
    "discount_value": "10.00",
    "tax_rate_percent": "18.00",
}


def test_valid_draft_terms():
    terms = DraftTermsInput.model_validate(BASE)
    assert terms.lines[0].quantity == 2
    assert terms.discount_value == 10


@pytest.mark.parametrize(
    "change",
    [
        {
            "lines": [
                {
                    "kind": "charge",
                    "product_id": str(uuid4()),
                    "description": "Labour",
                    "quantity": "1",
                    "unit_price": "10.00",
                }
            ]
        },
        {
            "lines": [
                {"kind": "charge", "description": "Labour", "quantity": "0", "unit_price": "10.00"}
            ]
        },
        {
            "lines": [
                {"kind": "charge", "description": "Labour", "quantity": 0.5, "unit_price": "10.00"}
            ]
        },
        {
            "lines": [
                {"kind": "charge", "description": "Labour", "quantity": "1", "unit_price": "10.001"}
            ]
        },
        {"discount_kind": "percent", "discount_value": "100.01"},
        {"discount_kind": "none", "discount_value": "1.00"},
        {"tax_rate_percent": "100.01"},
        {"discount_kind": "fixed", "discount_value": "201.00"},
    ],
)
def test_invalid_draft_terms(change):
    with pytest.raises(ValidationError):
        DraftTermsInput.model_validate(BASE | change)
