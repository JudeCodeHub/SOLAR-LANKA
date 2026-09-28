"""Build quotation history from stored revision snapshots only."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas.quotations import QuotationRevisionView, SentQuotationLine
from app.models.quotation import QuotationLineItem, QuotationRevision


def money(value):
    return format(value, ".2f") if value is not None else None


def revision_view(session: Session, revision: QuotationRevision) -> QuotationRevisionView:
    lines = session.scalars(
        select(QuotationLineItem)
        .where(QuotationLineItem.revision_id == revision.id)
        .order_by(QuotationLineItem.position)
    )
    return QuotationRevisionView(
        id=revision.id,
        quotation_id=revision.quotation_id,
        revision_number=revision.revision_number,
        status=revision.status,
        created_at=revision.created_at,
        sent_at=revision.sent_at,
        valid_until=revision.valid_until,
        capacity_kwp=(
            format(revision.capacity_kwp, ".3f") if revision.capacity_kwp is not None else None
        ),
        warranty_terms=revision.warranty_terms,
        exclusions=revision.exclusions,
        notes=revision.notes,
        subtotal=money(revision.subtotal),
        discount=money(revision.discount),
        tax=money(revision.tax),
        total=money(revision.total),
        lines=[
            SentQuotationLine(
                position=line.position,
                kind=line.kind,
                product_id=line.product_id,
                product_snapshot=line.product_snapshot,
                description=line.description,
                quantity=format(line.quantity, ".3f"),
                unit_price=money(line.unit_price),
                line_total=money(line.line_total),
            )
            for line in lines
        ],
    )
