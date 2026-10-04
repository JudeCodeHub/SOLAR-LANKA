"""Exported PDF text must carry exactly the stored revision figures and terms."""

from datetime import UTC, datetime
from io import BytesIO
from uuid import uuid4

from pypdf import PdfReader

from app.api.schemas.quotations import QuotationRevisionView, SentQuotationLine
from app.services.quotation_pdf import render_revision_pdf


def revision(**changes) -> QuotationRevisionView:
    values = {
        "id": uuid4(),
        "quotation_id": uuid4(),
        "revision_number": 3,
        "status": "sent",
        "created_at": datetime(2026, 1, 1, tzinfo=UTC),
        "sent_at": datetime(2026, 1, 2, tzinfo=UTC),
        "valid_until": datetime(2026, 2, 1, tzinfo=UTC),
        "capacity_kwp": "5.250",
        "warranty_terms": "Panels 10 years & inverter 5 years <fictional>",
        "exclusions": "Roof repairs excluded",
        "notes": None,
        "subtotal": "1500.00",
        "discount": "150.00",
        "tax": "270.00",
        "total": "1620.00",
        "lines": [
            SentQuotationLine(
                position=1,
                kind="equipment",
                product_id=None,
                product_snapshot=None,
                description="Fictional 450 W panel",
                quantity="10.000",
                unit_price="100.00",
                line_total="1000.00",
            ),
            SentQuotationLine(
                position=2,
                kind="charge",
                product_id=None,
                product_snapshot=None,
                description="Installation",
                quantity="1.000",
                unit_price="500.00",
                line_total="500.00",
            ),
        ],
    }
    return QuotationRevisionView(**(values | changes))


def pdf_text(data: bytes) -> str:
    return "\n".join(page.extract_text() for page in PdfReader(BytesIO(data)).pages)


def test_pdf_matches_stored_snapshot():
    data = render_revision_pdf("Fictional Solar Co", revision())
    assert data.startswith(b"%PDF")
    content = pdf_text(data)
    for expected in (
        "Fictional Solar Co",
        "Revision: 3",
        "5.250",
        "1500.00",
        "150.00",
        "270.00",
        "1620.00",
        "Fictional 450 W panel",
        "10.000",
        "Panels 10 years & inverter 5 years <fictional>",
        "Roof repairs excluded",
    ):
        assert expected in content


def test_pdf_does_not_recompute_totals():
    content = pdf_text(render_revision_pdf("Co", revision(total="9999.99")))
    assert "9999.99" in content
    assert "1620.00" not in content


def test_missing_terms_are_stated_not_invented():
    content = pdf_text(render_revision_pdf("Co", revision(notes=None, warranty_terms=None)))
    assert content.count("Not stated") >= 2
