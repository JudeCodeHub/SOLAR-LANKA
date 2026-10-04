"""Render a stored quotation revision snapshot as a PDF without recomputing any figure."""

from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.api.schemas.quotations import QuotationRevisionView

NOT_STATED = "Not stated"


def text(value: str | None) -> str:
    return escape(value).replace("\n", "<br/>") if value else NOT_STATED


def pdf_headers(revision_number: int) -> dict[str, str]:
    filename = f"quotation-r{revision_number}.pdf"
    return {
        "Cache-Control": "no-store",
        "Content-Disposition": f'attachment; filename="{filename}"',
    }


def render_revision_pdf(company_name: str, revision: QuotationRevisionView) -> bytes:
    styles = getSampleStyleSheet()
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Quotation revision {revision.revision_number}",
        author="Solar Lanka (fictional demo)",
    )
    body = styles["BodyText"]
    valid_until = revision.valid_until.isoformat() if revision.valid_until else NOT_STATED
    story = [
        Paragraph(f"Quotation - {escape(company_name)}", styles["Title"]),
        Paragraph("Fictional sample document from a portfolio demo.", body),
        Spacer(1, 6 * mm),
        Paragraph(f"Revision: {revision.revision_number}", body),
        Paragraph(f"Status: {revision.status}", body),
        Paragraph(
            f"Sent: {revision.sent_at.isoformat() if revision.sent_at else NOT_STATED}", body
        ),
        Paragraph(f"Valid until: {valid_until}", body),
        Paragraph(f"System capacity (kWp): {revision.capacity_kwp or NOT_STATED}", body),
        Spacer(1, 6 * mm),
    ]
    rows = [["#", "Description", "Qty", "Unit price", "Line total"]]
    for line in revision.lines:
        rows.append(
            [
                str(line.position),
                Paragraph(escape(line.description), body),
                line.quantity,
                line.unit_price,
                line.line_total or "",
            ]
        )
    table = Table(rows, colWidths=[10 * mm, 82 * mm, 22 * mm, 30 * mm, 30 * mm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story += [table, Spacer(1, 6 * mm)]
    totals = Table(
        [
            ["Subtotal", revision.subtotal or ""],
            ["Discount", revision.discount or ""],
            ["Tax", revision.tax or ""],
            ["Total", revision.total or ""],
        ],
        colWidths=[40 * mm, 40 * mm],
        hAlign="RIGHT",
    )
    totals.setStyle(
        TableStyle(
            [("ALIGN", (1, 0), (1, -1), "RIGHT"), ("FONTNAME", (0, 3), (-1, 3), "Helvetica-Bold")]
        )
    )
    story += [totals, Spacer(1, 6 * mm)]
    for heading, value in (
        ("Warranty terms", revision.warranty_terms),
        ("Exclusions", revision.exclusions),
        ("Notes", revision.notes),
    ):
        story += [Paragraph(heading, styles["Heading3"]), Paragraph(text(value), body)]
    document.build(story)
    return buffer.getvalue()
