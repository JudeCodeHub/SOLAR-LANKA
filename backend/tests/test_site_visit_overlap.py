"""A technician is never confirmed for two overlapping visits, including under concurrent writes."""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import VerifiedIdentity, require_identity
from app.models.company import Company, CompanyMembership
from app.models.estimator_config import EstimatorConfigVersion
from app.models.installation import Installation
from app.models.quotation import Quotation, QuotationRevision
from app.models.quotation_request import QuotationRequest, RequestDelivery
from app.models.saved_estimate import SavedEstimate
from app.models.site_visit import SiteVisit
from app.models.user import AppUser
from app.seed_demo import DEMO_COMPANIES, DEMO_CUSTOMER, DEMO_USERS, demo_id, seed_demo

pytestmark = pytest.mark.database

MOONLEAF = DEMO_COMPANIES[1][0]
STAFF_B = DEMO_USERS[1][1]
CUSTOMER = DEMO_CUSTOMER[1]
INSTALLATION = demo_id("accepted", "installation")
HOUR = timedelta(hours=1)


def slot_at(days: int, hour: int, hours: int = 2):
    start = (datetime.now(UTC) + timedelta(days=days)).replace(
        hour=hour, minute=0, second=0, microsecond=0
    ) - timedelta(hours=5, minutes=30)
    return {"starts_at": start.isoformat(), "ends_at": (start + hours * HOUR).isoformat()}


def test_api_refuses_a_double_booked_technician(database_client, database_session):
    client, session = database_client, database_session
    seed_demo(session, environment="test")
    tech = AppUser(clerk_subject="overlap_tech")
    tech_two = AppUser(clerk_subject="overlap_tech_two")
    session.add_all([tech, tech_two])
    session.flush()
    session.add_all(
        [
            CompanyMembership(user_id=tech.id, company_id=MOONLEAF, role="technician"),
            CompanyMembership(user_id=tech_two.id, company_id=MOONLEAF, role="technician"),
        ]
    )
    session.commit()

    def act_as(subject: str) -> None:
        client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
            subject, "session_test"
        )

    mine = f"/users/me/installations/{INSTALLATION}/site-visits"
    theirs = f"/companies/{MOONLEAF}/installations/{INSTALLATION}/site-visits"

    def request(slot):
        act_as(CUSTOMER)
        made = client.post(mine, json={"slots": [slot]}).json()
        return made["id"], made["slots"][0]["id"]

    def confirm(visit, slot, technician):
        act_as(STAFF_B)
        return client.post(
            f"{theirs}/{visit}/confirm", json={"slot_id": slot, "technician_id": str(technician.id)}
        )

    first, first_slot = request(slot_at(10, 9))  # 09:00-11:00
    assert confirm(first, first_slot, tech).status_code == 200

    # Overlapping by an hour: refused for the same technician, with a reason, and nothing changes.
    second, second_slot = request(slot_at(10, 10))  # 10:00-12:00
    clash = confirm(second, second_slot, tech)
    assert (
        clash.status_code == 409
        and "already has a confirmed visit" in clash.json()["error"]["message"]
    )
    act_as(CUSTOMER)
    still = next(v for v in client.get(mine).json() if v["id"] == second)
    assert still["status"] == "requested" and still["confirmed_starts_at"] is None

    # A different technician, or the moment the first visit ends, is fine.
    assert confirm(second, second_slot, tech_two).status_code == 200
    third, third_slot = request(slot_at(10, 11))  # 11:00-13:00 starts as the first ends
    assert confirm(third, third_slot, tech).status_code == 200

    # Offering alternatives to the first frees its time, so the earlier clash can be confirmed.
    act_as(STAFF_B)
    assert client.post(f"{theirs}/{first}/cancel", json={}).status_code == 200
    fourth, fourth_slot = request(slot_at(10, 9, hours=2))
    assert confirm(fourth, fourth_slot, tech).status_code == 200
    # ...and the customer cannot accept an alternative that now collides.
    act_as(STAFF_B)
    other, other_slot = request(slot_at(11, 9))
    assert confirm(other, other_slot, tech).status_code == 200  # tech busy 11th 09-11
    fifth, _ = request(slot_at(12, 9))
    act_as(STAFF_B)
    offer = client.post(
        f"{theirs}/{fifth}/propose",
        json={"slots": [slot_at(11, 10)], "technician_id": str(tech.id)},
    ).json()
    proposed = next(s["id"] for s in offer["slots"] if s["kind"] == "proposed")
    act_as(CUSTOMER)
    refused = client.post(f"{mine}/{fifth}/accept", json={"slot_id": proposed})
    assert (
        refused.status_code == 409 and "no longer available" in refused.json()["error"]["message"]
    )


def test_concurrent_confirmations_have_one_winner(database_engine):
    """Separate connections confirm overlapping visits for one technician at the same moment."""
    schema = f"visit_race_{uuid4().hex}"
    try:
        with database_engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
            connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
            for model in (
                AppUser, Company, EstimatorConfigVersion, SavedEstimate, QuotationRequest,
                RequestDelivery, Quotation, QuotationRevision, Installation, SiteVisit,
            ):  # fmt: skip
                model.__table__.create(connection)
            with Session(bind=connection) as session:
                owner = AppUser(clerk_subject=f"race_owner_{schema}")
                technician = AppUser(clerk_subject=f"race_tech_{schema}")
                companies = [Company(name=f"Fictional visit race {n}") for n in (1, 2)]
                session.add_all([owner, technician, *companies])
                session.flush()
                installation_ids = []
                for number, company in enumerate(companies, start=1):
                    request = QuotationRequest(
                        customer_id=owner.id,
                        requirements={"district": "Colombo", "details": "Race"},
                    )
                    session.add(request)
                    session.flush()
                    delivery = RequestDelivery(request_id=request.id, company_id=company.id)
                    session.add(delivery)
                    session.flush()
                    quotation = Quotation(delivery_id=delivery.id)
                    session.add(quotation)
                    session.flush()
                    revision = QuotationRevision(
                        quotation_id=quotation.id,
                        request_id=request.id,
                        revision_number=number,
                        status="accepted",
                        currency="LKR",
                        sent_at=datetime.now(UTC) - timedelta(days=1),
                        valid_until=datetime.now(UTC) + timedelta(days=1),
                    )
                    session.add(revision)
                    session.flush()
                    installation = Installation(accepted_revision_id=revision.id)
                    session.add(installation)
                    session.flush()
                    installation_ids.append(installation.id)
                owner_id, technician_id = owner.id, technician.id

        start = datetime.now(UTC) + timedelta(days=5)

        def confirm(installation_id, begin, length, tech_id, barrier):
            with database_engine.connect() as connection:
                connection.execute(text(f'SET search_path TO "{schema}"'))
                connection.commit()  # the session below must own its transaction
                with Session(bind=connection) as session:
                    session.add(
                        SiteVisit(
                            installation_id=installation_id,
                            requested_by=owner_id,
                            status="confirmed",
                            timezone="Asia/Colombo",
                            technician_id=tech_id,
                            confirmed_starts_at=begin,
                            confirmed_ends_at=begin + length,
                        )
                    )
                    barrier.wait()
                    try:
                        session.commit()
                        return True
                    except IntegrityError as error:
                        session.rollback()
                        assert "ex_site_visits_technician_overlap" in str(error.orig)
                        return False

        def race(a, b, tech_a, tech_b):
            barrier = Barrier(2)
            with ThreadPoolExecutor(2) as pool:
                jobs = [
                    pool.submit(confirm, installation_ids[0], *a, tech_a, barrier),
                    pool.submit(confirm, installation_ids[1], *b, tech_b, barrier),
                ]
                return sorted(job.result() for job in jobs)

        two_hours = timedelta(hours=2)
        # Overlapping times, one technician: exactly one commits.
        assert race(
            (start, two_hours), (start + HOUR, two_hours), technician_id, technician_id
        ) == [False, True]
        # Back to back, or different technicians, both commit.
        later = start + timedelta(days=1)
        assert race(
            (later, two_hours), (later + two_hours, two_hours), technician_id, technician_id
        ) == [True, True]
        other = start + timedelta(days=2)
        assert race((other, two_hours), (other, two_hours), technician_id, None) == [True, True]

        with database_engine.connect() as connection:
            connection.execute(text(f'SET search_path TO "{schema}"'))
            connection.commit()
            with Session(bind=connection) as session:
                confirmed = session.scalars(
                    select(SiteVisit).where(SiteVisit.technician_id == technician_id)
                ).all()
                assert (
                    len(confirmed) == 4
                )  # the clash winner, two back to back, one beside an unassigned visit
                ranges = sorted((v.confirmed_starts_at, v.confirmed_ends_at) for v in confirmed)
                for (_, end), (begin, _) in zip(ranges, ranges[1:], strict=False):
                    assert begin >= end  # no two confirmed visits overlap
                # A cancelled visit does not hold the technician's time.
                session.add(
                    SiteVisit(
                        installation_id=installation_ids[0],
                        requested_by=owner_id,
                        status="cancelled",
                        timezone="Asia/Colombo",
                        technician_id=technician_id,
                        confirmed_starts_at=ranges[0][0],
                        confirmed_ends_at=ranges[0][1],
                    )
                )
                session.commit()
    finally:
        with database_engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))
