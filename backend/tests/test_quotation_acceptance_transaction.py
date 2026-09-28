"""Acceptance eligibility is rechecked while holding the write transaction."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select, text

from app.core.auth import VerifiedIdentity, require_identity
from app.core.quotation_acceptance import AcceptanceFailure
from app.models.company import Company
from app.models.estimator_config import EstimatorConfigVersion
from app.models.installation import Installation
from app.models.quotation import Quotation, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.saved_estimate import SavedEstimate
from app.models.user import AppUser
from app.services.quotation_acceptance import (
    AcceptanceRejected,
    accept_revision_in_transaction,
)

pytestmark = pytest.mark.database


def test_acceptance_rechecks_inside_transaction(
    database_client, database_connection, database_session
):
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
        Installation,
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
            quotation_id=quotations[0].id,
            revision_id=revisions[0].id,
            now=now,
        )
    assert hidden.value.failure is AcceptanceFailure.NOT_FOUND
    accepted = accept_revision_in_transaction(
        database_session,
        customer_id=owner.id,
        request_id=request.id,
        quotation_id=quotations[0].id,
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
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        owner.clerk_subject, "session_test"
    )
    accept_path = (
        f"/users/me/requests/{request.id}/quotations/{quotations[0].id}"
        f"/revisions/{revisions[0].id}/accept"
    )
    accepted_response = database_client.post(accept_path)
    assert accepted_response.status_code == 201
    assert accepted_response.json()["revision_id"] == str(revisions[0].id)
    installation = database_session.scalar(select(Installation))
    assert installation is not None
    assert str(installation.id) == accepted_response.json()["installation_id"]
    assert installation.accepted_revision_id == revisions[0].id
    database_session.refresh(revisions[0])
    assert revisions[0].status == "accepted"
    retry_response = database_client.post(accept_path)
    assert retry_response.status_code == 200
    assert retry_response.json() == accepted_response.json()
    assert len(database_session.scalars(select(Installation)).all()) == 1

    competing_path = (
        f"/users/me/requests/{request.id}/quotations/{quotations[1].id}"
        f"/revisions/{revisions[1].id}/accept"
    )
    competing_response = database_client.post(competing_path)
    assert competing_response.status_code == 409
    database_session.refresh(revisions[1])
    assert revisions[1].status == "sent"
    assert len(database_session.scalars(select(Installation)).all()) == 1

    failing_request = QuotationRequest(
        customer_id=owner.id, requirements={"district": "Colombo", "details": "Second quote"}
    )
    database_session.add(failing_request)
    database_session.flush()
    failing_delivery = RequestDelivery(request_id=failing_request.id, company_id=company_a.id)
    database_session.add(failing_delivery)
    database_session.flush()
    failing_quote = Quotation(delivery_id=failing_delivery.id)
    database_session.add(failing_quote)
    database_session.flush()
    failing_revision = QuotationRevision(
        quotation_id=failing_quote.id,
        request_id=failing_request.id,
        revision_number=1,
        status="sent",
        currency="LKR",
        sent_at=now - timedelta(days=1),
        valid_until=now + timedelta(days=1),
    )
    database_session.add(failing_revision)
    database_session.commit()
    database_session.execute(
        text(
            "ALTER TABLE installations ADD CONSTRAINT ck_reject_failure_test "
            f"CHECK (accepted_revision_id <> '{failing_revision.id}')"
        )
    )
    database_session.commit()
    failure_path = (
        f"/users/me/requests/{failing_request.id}/quotations/{failing_quote.id}"
        f"/revisions/{failing_revision.id}/accept"
    )
    assert database_client.post(failure_path).status_code == 409
    database_session.refresh(failing_revision)
    assert failing_revision.status == "sent"
    assert (
        database_session.scalar(
            select(Installation).where(Installation.accepted_revision_id == failing_revision.id)
        )
        is None
    )
