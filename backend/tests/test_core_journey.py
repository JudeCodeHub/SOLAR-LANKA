"""Backend completion gate: the whole core journey through the public API."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.core.auth import VerifiedIdentity, require_identity
from app.models.company import Company
from app.models.media_asset import MediaAsset
from app.models.notification import Notification
from app.models.outbox_event import OutboxEvent
from app.models.product import Product
from app.models.user import AppUser
from app.seed_demo import DEMO_COMPANIES, DEMO_CUSTOMER, DEMO_USERS, seed_demo
from app.services.workflow_notifications import process_workflow_event
from tests.test_estimate_preview import request_body
from tests.test_estimator_finance import financial_config

pytestmark = pytest.mark.database

COMPANY_A, COMPANY_B, *_ = (company_id for company_id, _ in DEMO_COMPANIES)
STAFF_A, STAFF_B, *_ = (subject for _, subject in DEMO_USERS)
CUSTOMER = DEMO_CUSTOMER[1]
OTHER_CUSTOMER = "journey_other_customer"


def terms(product_id, *, panels: str, panel_price: str, charge: str, discount: str, tax: str):
    return {
        "lines": [
            {
                "kind": "equipment",
                "product_id": str(product_id),
                "description": "Solar panel",
                "quantity": panels,
                "unit_price": panel_price,
            },
            {
                "kind": "charge",
                "description": "Installation",
                "quantity": "1",
                "unit_price": charge,
            },
        ],
        "discount_kind": "percent" if discount != "0.00" else "none",
        "discount_value": discount,
        "tax_rate_percent": tax,
        "capacity_kwp": "3.000",
        "warranty_terms": "Fictional 10 year panel warranty",
        "exclusions": "Roof repairs excluded",
        "validity_days": 30,
    }


def test_core_journey_works_through_the_api(database_client, database_session):
    client = database_client
    session = database_session

    def act_as(subject: str) -> None:
        client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
            subject, "journey_session"
        )

    # Setup: fictional demo fixtures, approved companies, a published estimator version.
    seed_demo(session, environment="test")
    session.add(AppUser(clerk_subject=OTHER_CUSTOMER))
    config = financial_config()
    config.published_at = datetime.now(UTC)
    config.source_metadata["yield"].update(
        {
            "publisher": "Fictional test source",
            "title": "Fictional yield",
            "unit": "kWh/kWp/year",
            "reviewed_on": "2026-09-28",
        }
    )
    session.add(config)
    session.commit()
    panel = session.scalars(select(Product).where(Product.kind == "panel")).first()

    # Each company declares where and what it serves through its own profile route.
    for subject, company in ((STAFF_A, COMPANY_A), (STAFF_B, COMPANY_B)):
        act_as(subject)
        profile = client.patch(
            f"/companies/{company}",
            json={"service_districts": ["Colombo"], "services": ["installation"]},
        )
        assert profile.status_code == 200, profile.json()
    # Approval follows the edit (an edited profile returns to review).
    session.expire_all()
    for company in session.scalars(select(Company)):
        company.publication_status = "approved"
    session.commit()

    # 1. A visitor estimates without signing in; nothing is stored.
    client.app.dependency_overrides.pop(require_identity, None)
    preview = client.post("/estimates/preview", json=request_body())
    assert preview.status_code == 200

    # 2. The customer saves the estimate and requests quotations from both companies.
    act_as(CUSTOMER)
    saved = client.post("/users/me/estimates", json=request_body())
    assert saved.status_code == 201
    submission = {
        "district": "Colombo",
        "details": "Fictional 3 kW rooftop system",
        "monthly_consumption_kwh": "300",
        "saved_estimate_id": saved.json()["id"],
        "company_ids": [str(COMPANY_A), str(COMPANY_B)],
    }
    key = {"Idempotency-Key": str(uuid4())}
    submitted = client.post("/users/me/requests", json=submission, headers=key)
    assert submitted.status_code == 201, submitted.json()
    request_id = submitted.json()["id"]
    delivery = {d["company_id"]: d["id"] for d in submitted.json()["deliveries"]}
    assert set(delivery) == {str(COMPANY_A), str(COMPANY_B)}
    retried = client.post("/users/me/requests", json=submission, headers=key)
    assert retried.json()["id"] == request_id  # a retry does not create a second request
    act_as(OTHER_CUSTOMER)
    assert client.get(f"/users/me/requests/{request_id}").status_code == 404

    # 3. Each company sees only its own delivery and sends an itemised offer.
    offers = {}
    for subject, company, spec in (
        (
            STAFF_A,
            COMPANY_A,
            terms(
                panel.id,
                panels="2",
                panel_price="100.05",
                charge="50.00",
                discount="10.00",
                tax="18.00",
            ),
        ),
        (
            STAFF_B,
            COMPANY_B,
            terms(
                panel.id,
                panels="1",
                panel_price="90.00",
                charge="40.00",
                discount="0.00",
                tax="0.00",
            ),
        ),
    ):
        act_as(subject)
        base = f"/companies/{company}/request-deliveries"
        own = delivery[str(company)]
        inbox = client.get(base)
        assert request_id in [item["request_id"] for item in inbox.json()["items"]]
        other = COMPANY_B if company == COMPANY_A else COMPANY_A
        assert (
            client.get(f"/companies/{other}/request-deliveries/{delivery[str(other)]}").status_code
            == 403
        )
        created = client.post(f"{base}/{own}/quotations")
        assert created.status_code == 201
        quotation_id = created.json()["id"]
        edit = client.put(f"{base}/{own}/quotations/{quotation_id}/draft", json=spec)
        assert edit.status_code == 200
        sent = client.post(f"{base}/{own}/quotations/{quotation_id}/send")
        assert sent.status_code == 200
        offers[company] = (quotation_id, sent.json()["revision_id"], sent.json()["total"])
    assert offers[COMPANY_A][2] == "265.61"
    assert offers[COMPANY_B][2] == "130.00"
    # A competitor cannot read the other company's offer.
    act_as(STAFF_B)
    foreign = client.get(
        f"/companies/{COMPANY_A}/request-deliveries/{delivery[str(COMPANY_A)]}"
        f"/quotations/{offers[COMPANY_A][0]}/revisions"
    )
    assert foreign.status_code == 403

    # 4. The customer compares; the cheaper offer is not presented as the best one.
    act_as(CUSTOMER)
    comparison = client.get(f"/users/me/requests/{request_id}/quotations/compare")
    assert comparison.status_code == 200
    body = comparison.json()
    assert {offer["company_id"] for offer in body["offers"]} == {str(COMPANY_A), str(COMPANY_B)}
    assert {offer["total_lkr"] for offer in body["offers"]} == {"265.61", "130.00"}
    ranking_words = {"best", "recommended", "rank", "winner"}
    assert not ranking_words & set(body)
    assert all(not ranking_words & set(offer) for offer in body["offers"])
    assert "Compare inclusions" in body["comparison_note"]

    # 5. Accepting one exact revision creates the installation; the other offer cannot win.
    quotation_a, revision_a, _ = offers[COMPANY_A]
    quotation_b, revision_b, _ = offers[COMPANY_B]
    accept = (
        f"/users/me/requests/{request_id}/quotations/{quotation_a}/revisions/{revision_a}/accept"
    )
    accepted = client.post(accept)
    assert accepted.status_code == 201
    installation_id = accepted.json()["installation_id"]
    assert accepted.json()["revision_id"] == revision_a
    competing = client.post(
        f"/users/me/requests/{request_id}/quotations/{quotation_b}/revisions/{revision_b}/accept"
    )
    assert competing.status_code == 409
    repeat = client.post(accept)  # a retry is idempotent: same installation, no second one
    assert repeat.status_code == 200
    assert repeat.json() == accepted.json()

    # 6. Tracking: the customer finds the installation and sees the ordered milestones.
    listed = client.get("/users/me/installations")
    mine = {item["id"]: item for item in listed.json()["items"]}
    assert mine[installation_id]["completed_milestones"] == 0
    assert mine[installation_id]["total_milestones"] == 8
    progress = client.get(f"/users/me/installations/{installation_id}").json()
    assert [m["status"] for m in progress["milestones"]] == ["in_progress"] + ["pending"] * 7
    first, second, third = (m["id"] for m in progress["milestones"][:3])
    act_as(OTHER_CUSTOMER)
    assert client.get(f"/users/me/installations/{installation_id}").status_code == 404
    assert installation_id not in [
        item["id"] for item in client.get("/users/me/installations").json()["items"]
    ]
    act_as(CUSTOMER)

    # 7. The winning company works the milestones; rules and visibility are enforced.
    act_as(STAFF_A)
    own_installations = client.get(f"/companies/{COMPANY_A}/installations")
    assert [item["id"] for item in own_installations.json()["items"]] == [installation_id]
    act_as(STAFF_B)
    losing = client.get(f"/companies/{COMPANY_B}/installations")
    assert installation_id not in [item["id"] for item in losing.json()["items"]]
    assert client.get(f"/companies/{COMPANY_A}/installations/{installation_id}").status_code == 403
    act_as(STAFF_A)
    base = f"/companies/{COMPANY_A}/installations/{installation_id}"
    assert client.put(f"{base}/milestones/{first}", json={"status": "completed"}).status_code == 409
    assert (
        client.put(f"{base}/milestones/{third}", json={"status": "in_progress"}).status_code == 409
    )
    update = client.post(
        f"{base}/milestones/{first}/updates",
        json={"reason": "Awaiting roof access", "next_action": "Reschedule survey"},
    )
    assert update.status_code == 200
    staff_user = session.scalars(select(AppUser).where(AppUser.clerk_subject == STAFF_A)).one()
    evidence = MediaAsset(
        provider="imagekit",
        provider_file_id=f"journey_{uuid4().hex}",
        owner_user_id=staff_user.id,
        category="installation_evidence",
        parent_kind="installation",
        parent_id=installation_id,
        visibility="private",
    )
    session.add(evidence)
    session.commit()
    done = client.put(
        f"{base}/milestones/{first}",
        json={
            "status": "completed",
            "evidence": [{"kind": "site_survey_record", "asset_id": str(evidence.id)}],
        },
    )
    assert done.status_code == 200
    assert (
        client.put(f"{base}/milestones/{second}", json={"status": "in_progress"}).status_code == 200
    )
    note = client.post(f"{base}/internal-notes", json={"body": "Customer has a large dog"})
    assert note.status_code == 201

    # 8. The customer sees shared progress and history but never internal notes.
    act_as(CUSTOMER)
    seen = client.get(f"/users/me/installations/{installation_id}")
    assert seen.status_code == 200
    assert [m["status"] for m in seen.json()["milestones"][:3]] == [
        "completed",
        "in_progress",
        "pending",
    ]
    assert any(h["next_action"] == "Reschedule survey" for h in seen.json()["history"])
    assert "large dog" not in seen.text
    assert client.get(f"{base}/internal-notes").status_code == 403
    after = {item["id"]: item for item in client.get("/users/me/installations").json()["items"]}
    assert after[installation_id]["completed_milestones"] == 1

    # 9. Committed business changes left durable events; delivery is idempotent.
    events = session.execute(select(OutboxEvent.event_key, OutboxEvent.event_type)).all()
    types = [event_type for _, event_type in events]
    assert types.count("quotation.accepted") == 1
    assert f"quotation.accepted:{revision_a}" in [key for key, _ in events]
    assert "installation.milestone_changed" in types

    def deliver_all() -> int:
        for event_key, _ in events:
            process_workflow_event(session, event_key)
        session.commit()
        return session.scalar(select(func.count()).select_from(Notification))

    first_count = deliver_all()
    assert first_count > 0
    assert deliver_all() == first_count  # replaying every event creates nothing new

    customer_user = session.scalars(select(AppUser).where(AppUser.clerk_subject == CUSTOMER)).one()
    mine = client.get("/users/me/notifications")
    assert mine.status_code == 200
    items = mine.json()["items"]
    assert any(item["target_id"] == installation_id for item in items)
    assert all(item["id"] for item in items)
    own_rows = session.scalars(
        select(Notification).where(Notification.recipient_id == customer_user.id)
    ).all()
    assert mine.json()["total"] == len(own_rows)
    act_as(OTHER_CUSTOMER)
    assert client.get("/users/me/notifications").json()["total"] == 0
