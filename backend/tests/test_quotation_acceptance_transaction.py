"""Acceptance eligibility is rechecked while holding the write transaction."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import select, text

from app.core.auth import VerifiedIdentity, require_identity
from app.core.installation_milestones import SEQUENCE
from app.core.quotation_acceptance import AcceptanceFailure
from app.models.company import Company, CompanyMembership
from app.models.estimator_config import EstimatorConfigVersion
from app.models.installation import Installation
from app.models.installation_milestone import InstallationMilestoneRecord
from app.models.media_asset import MediaAsset
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
        CompanyMembership,
        EstimatorConfigVersion,
        SavedEstimate,
        QuotationRequest,
        RequestDelivery,
        Quotation,
        QuotationRevision,
        Installation,
        InstallationMilestoneRecord,
        MediaAsset,
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
    # Foreign identities and mismatched revision IDs must never reach a write.
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        foreign.clerk_subject, "session_test"
    )
    assert database_client.post(accept_path).status_code == 404
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        owner.clerk_subject, "session_test"
    )
    mismatched_path = (
        f"/users/me/requests/{request.id}/quotations/{quotations[0].id}"
        f"/revisions/{revisions[1].id}/accept"
    )
    assert database_client.post(mismatched_path).status_code == 404

    # Every ineligible state leaves the original revision and installation untouched.
    invalid_states = (
        (request, "status", "closed"),
        (deliveries[0], "status", "closed"),
        (revisions[0], "status", "draft"),
        (revisions[0], "status", "withdrawn"),
        (revisions[0], "valid_until", now - timedelta(hours=1)),
    )
    for record, field, invalid_value in invalid_states:
        original_value = getattr(record, field)
        setattr(record, field, invalid_value)
        database_session.commit()
        assert database_client.post(accept_path).status_code == 409
        database_session.refresh(revisions[0])
        assert revisions[0].status != "accepted"
        assert database_session.scalar(select(Installation.id)) is None
        setattr(record, field, original_value)
        database_session.commit()

    accepted_response = database_client.post(accept_path)
    assert accepted_response.status_code == 201
    assert accepted_response.json()["revision_id"] == str(revisions[0].id)
    installation = database_session.scalar(select(Installation))
    assert installation is not None
    assert str(installation.id) == accepted_response.json()["installation_id"]
    assert installation.accepted_revision_id == revisions[0].id
    milestones = database_session.scalars(
        select(InstallationMilestoneRecord)
        .where(InstallationMilestoneRecord.installation_id == installation.id)
        .order_by(InstallationMilestoneRecord.position)
    ).all()
    assert [row.kind for row in milestones] == [milestone.value for milestone in SEQUENCE]
    assert [row.status for row in milestones] == ["in_progress", *["pending"] * 7]
    customer_path = f"/users/me/installations/{installation.id}"
    customer_progress = database_client.get(customer_path)
    assert customer_progress.status_code == 200
    assert [row["kind"] for row in customer_progress.json()["milestones"]] == [
        milestone.value for milestone in SEQUENCE
    ]
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        foreign.clerk_subject, "session_test"
    )
    assert database_client.get(customer_path).status_code == 404

    accepted_staff = CompanyMembership(user_id=foreign.id, company_id=company_a.id, role="sales")
    other_staff = CompanyMembership(user_id=foreign.id, company_id=company_b.id, role="sales")
    database_session.add_all([accepted_staff, other_staff])
    database_session.commit()
    accepted_company_path = f"/companies/{company_a.id}/installations/{installation.id}"
    other_company_path = f"/companies/{company_b.id}/installations/{installation.id}"
    assert database_client.get(accepted_company_path).json() == customer_progress.json()
    assert database_client.get(other_company_path).status_code == 404
    other_staff.status = "suspended"
    database_session.commit()
    assert database_client.get(other_company_path).status_code == 403
    first_path = f"{accepted_company_path}/milestones/{milestones[0].id}"
    second_path = f"{accepted_company_path}/milestones/{milestones[1].id}"
    assert database_client.put(first_path, json={"status": "completed"}).status_code == 409
    assert database_client.put(second_path, json={"status": "in_progress"}).status_code == 409
    evidence = MediaAsset(
        provider="local_private",
        provider_file_id=f"survey_{uuid4().hex}",
        owner_user_id=foreign.id,
        category="installation_evidence",
        parent_kind="installation",
        parent_id=installation.id,
        visibility="private",
    )
    foreign_evidence = MediaAsset(
        provider="local_private",
        provider_file_id=f"foreign_{uuid4().hex}",
        owner_user_id=foreign.id,
        category="installation_evidence",
        parent_kind="installation",
        parent_id=uuid4(),
        visibility="private",
    )
    database_session.add_all([evidence, foreign_evidence])
    database_session.commit()

    def completion(asset_id):
        return {
            "status": "completed",
            "evidence": [{"kind": "site_survey_record", "asset_id": str(asset_id)}],
        }

    assert database_client.put(first_path, json=completion(foreign_evidence.id)).status_code == 409
    database_session.refresh(milestones[0])
    assert milestones[0].status == "in_progress"
    assert database_client.put(first_path, json=completion(evidence.id)).status_code == 200
    database_session.refresh(milestones[0])
    assert milestones[0].evidence_refs == [
        {"kind": "site_survey_record", "asset_id": str(evidence.id)}
    ]
    assert database_client.put(first_path, json=completion(evidence.id)).status_code == 409
    assert database_client.put(second_path, json={"status": "in_progress"}).status_code == 200
    database_client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        owner.clerk_subject, "session_test"
    )
    database_session.refresh(revisions[0])
    assert revisions[0].status == "accepted"
    retry_response = database_client.post(accept_path)
    assert retry_response.status_code == 200
    assert retry_response.json() == accepted_response.json()
    assert len(database_session.scalars(select(InstallationMilestoneRecord)).all()) == 8
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
    assert len(database_session.scalars(select(InstallationMilestoneRecord)).all()) == 8

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
    assert len(database_session.scalars(select(InstallationMilestoneRecord)).all()) == 8


def test_competing_acceptance_has_one_committed_winner(database_engine):
    """Separate connections race on one request; a rolled-back attempt leaves no winner."""
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    from sqlalchemy.orm import Session

    schema = f"acceptance_race_{uuid4().hex}"
    try:
        with database_engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
            connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
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
                model.__table__.create(connection)
            with Session(bind=connection) as session:
                owner = AppUser(clerk_subject=f"race_owner_{schema}")
                companies = [Company(name=f"Fictional race {index}") for index in range(2)]
                session.add_all([owner, *companies])
                session.flush()
                request = QuotationRequest(
                    customer_id=owner.id,
                    requirements={"district": "Colombo", "details": "Race"},
                )
                session.add(request)
                session.flush()
                revisions = []
                now = datetime.now(UTC)
                for company in companies:
                    delivery = RequestDelivery(request_id=request.id, company_id=company.id)
                    session.add(delivery)
                    session.flush()
                    quotation = Quotation(delivery_id=delivery.id)
                    session.add(quotation)
                    session.flush()
                    revision = QuotationRevision(
                        quotation_id=quotation.id,
                        request_id=request.id,
                        revision_number=1,
                        status="sent",
                        currency="LKR",
                        sent_at=now - timedelta(days=1),
                        valid_until=now + timedelta(days=1),
                    )
                    session.add(revision)
                    revisions.append(revision)
                session.flush()
                owner_id, request_id = owner.id, request.id
                targets = [(revision.quotation_id, revision.id) for revision in revisions]

        # A failed transaction must release its tentative acceptance and installation.
        with database_engine.connect() as connection:
            connection.execute(text(f'SET search_path TO "{schema}"'))
            with Session(bind=connection) as session:
                revision = accept_revision_in_transaction(
                    session,
                    customer_id=owner_id,
                    request_id=request_id,
                    quotation_id=targets[0][0],
                    revision_id=targets[0][1],
                )
                session.add(Installation(accepted_revision_id=revision.id))
                session.flush()
                session.rollback()

        barrier = Barrier(2)

        def attempt(target):
            quotation_id, revision_id = target
            with database_engine.connect() as connection:
                connection.execute(text(f'SET search_path TO "{schema}"'))
                connection.commit()
                with Session(bind=connection) as session:
                    barrier.wait(timeout=10)
                    try:
                        revision = accept_revision_in_transaction(
                            session,
                            customer_id=owner_id,
                            request_id=request_id,
                            quotation_id=quotation_id,
                            revision_id=revision_id,
                        )
                        session.add(Installation(accepted_revision_id=revision.id))
                        session.commit()
                        return "accepted"
                    except AcceptanceRejected as error:
                        session.rollback()
                        return error.failure

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(attempt, targets))
        assert sorted(str(result) for result in results) == ["accepted", "winner_exists"]
        with database_engine.connect() as connection:
            connection.execute(text(f'SET search_path TO "{schema}"'))
            with Session(bind=connection) as session:
                winners = session.scalars(
                    select(QuotationRevision).where(QuotationRevision.status == "accepted")
                ).all()
                installations = session.scalars(select(Installation)).all()
                assert len(winners) == len(installations) == 1
                assert installations[0].accepted_revision_id == winners[0].id
    finally:
        with database_engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
