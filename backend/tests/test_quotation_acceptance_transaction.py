"""Acceptance eligibility is rechecked while holding the write transaction."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select, text

from app.core.quotation_acceptance import AcceptanceFailure
from app.models.company import Company
from app.models.estimator_config import EstimatorConfigVersion
from app.models.quotation import Quotation, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.saved_estimate import SavedEstimate
from app.models.user import AppUser
from app.services.quotation_acceptance import (
    AcceptanceRejected,
    accept_revision_in_transaction,
)

pytestmark = pytest.mark.database


def test_acceptance_rechecks_inside_transaction(database_connection, database_session):
    schema = f"acceptance_lock_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    for model in (
        AppUser,
        Company,
        EstimatorConfigVersion,
        SavedEstimate,
        QuotationRequest,
        RequestDelivery,
        Quotation,
        QuotationRevision,
    ):
        model.__table__.create(database_connection)
    owner = AppUser(clerk_subject="user_accept_owner")
    foreign = AppUser(clerk_subject="user_accept_foreign")
    company_a = Company(name="Fictional A")
    company_b = Company(name="Fictional B")
    database_session.add_all([owner, foreign, company_a, company_b])
    database_session.flush()
    request = QuotationRequest(
        customer_id=owner.id, requirements={"district": "Colombo", "details": "Quote"}
    )
    database_session.add(request)
    database_session.flush()
    deliveries = [
        RequestDelivery(request_id=request.id, company_id=company.id)
        for company in (company_a, company_b)
    ]
    database_session.add_all(deliveries)
    database_session.flush()
    quotations = [Quotation(delivery_id=delivery.id) for delivery in deliveries]
    database_session.add_all(quotations)
    database_session.flush()
    now = datetime.now(UTC)
    revisions = [
        QuotationRevision(
            quotation_id=quotation.id,
            request_id=request.id,
            revision_number=1,
            status="sent",
            currency="LKR",
            sent_at=now - timedelta(days=1),
            valid_until=now + timedelta(days=1),
        )
        for quotation in quotations
    ]
    database_session.add_all(revisions)
    database_session.commit()
    with pytest.raises(AcceptanceRejected) as hidden:
        accept_revision_in_transaction(
            database_session,
            customer_id=foreign.id,
            request_id=request.id,
            revision_id=revisions[0].id,
            now=now,
        )
    assert hidden.value.failure is AcceptanceFailure.NOT_FOUND
    accepted = accept_revision_in_transaction(
        database_session,
        customer_id=owner.id,
        request_id=request.id,
        revision_id=revisions[0].id,
        now=now,
    )
    assert accepted.status == "accepted"
    assert database_session.in_transaction()
    database_session.rollback()
    assert (
        database_session.scalar(
            select(QuotationRevision.status).where(QuotationRevision.id == revisions[0].id)
        )
        == "sent"
    )
    accept_revision_in_transaction(
        database_session,
        customer_id=owner.id,
        request_id=request.id,
        revision_id=revisions[0].id,
        now=now,
    )
    database_session.commit()
    with pytest.raises(AcceptanceRejected) as competing:
        accept_revision_in_transaction(
            database_session,
            customer_id=owner.id,
            request_id=request.id,
            revision_id=revisions[1].id,
            now=now,
        )
    assert competing.value.failure is AcceptanceFailure.WINNER_EXISTS
    database_session.refresh(revisions[1])
    assert revisions[1].status == "sent"
