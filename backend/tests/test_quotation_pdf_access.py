"""Both quotation PDF routes serve only the people a revision belongs to, over real HTTP."""

from io import BytesIO
from uuid import uuid4

import pytest
from pypdf import PdfReader

from app.core.auth import VerifiedIdentity, require_identity
from app.models.company import CompanyMembership
from app.models.user import AppUser
from app.seed_demo import DEMO_COMPANIES, DEMO_CUSTOMER, DEMO_USERS, demo_id, seed_demo

pytestmark = pytest.mark.database

COMPANY_A, COMPANY_B = DEMO_COMPANIES[0][0], DEMO_COMPANIES[1][0]
ADMIN_A, ADMIN_B = DEMO_USERS[0][1], DEMO_USERS[1][1]
CUSTOMER = DEMO_CUSTOMER[1]

REQUEST = demo_id("revised", "request")
DELIVERY = demo_id("revised", "delivery")
QUOTATION = demo_id("revised", "quotation")
REVISIONS = (demo_id("revised", "revision", "1"), demo_id("revised", "revision", "2"))
DRAFT = (
    demo_id("pending", "request"),
    demo_id("pending", "delivery"),
    demo_id("pending", "quotation"),
    demo_id("pending", "revision", "1"),
)
OTHER_REVISION = demo_id("accepted", "revision", "1")


def customer_url(revision, request=REQUEST, quotation=QUOTATION) -> str:
    return f"/users/me/requests/{request}/quotations/{quotation}/revisions/{revision}/pdf"


def company_url(revision, company=COMPANY_A, delivery=DELIVERY, quotation=QUOTATION) -> str:
    return (
        f"/companies/{company}/request-deliveries/{delivery}"
        f"/quotations/{quotation}/revisions/{revision}/pdf"
    )


def act_as(client, subject: str | None) -> None:
    if subject is None:
        client.app.dependency_overrides.pop(require_identity, None)
        return
    client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
        subject, "session_test"
    )


def text_of(response) -> str:
    return "\n".join(page.extract_text() for page in PdfReader(BytesIO(response.content)).pages)


@pytest.fixture
def world(database_client, database_session):
    seed_demo(database_session, environment="test")
    people = {name: AppUser(clerk_subject=f"pdf_{name}") for name in ("sales", "tech", "off", "x")}
    database_session.add_all(people.values())
    database_session.flush()
    for name, role, status in (
        ("sales", "sales", "active"),
        ("tech", "technician", "active"),
        ("off", "sales", "suspended"),
    ):
        database_session.add(
            CompanyMembership(
                user_id=people[name].id, company_id=COMPANY_A, role=role, status=status
            )
        )
    database_session.commit()
    return database_client, database_session


def test_the_owner_gets_the_exact_sent_revision(world):
    client, _ = world
    act_as(client, CUSTOMER)
    response = client.get(customer_url(REVISIONS[1]))
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["content-disposition"] == 'attachment; filename="quotation-r2.pdf"'
    assert response.content.startswith(b"%PDF")
    content = text_of(response)
    assert "Revision: 2" in content and "500000.00" in content
    # An earlier sent revision of the same offer is also theirs.
    assert "Revision: 1" in text_of(client.get(customer_url(REVISIONS[0])))


def test_nobody_else_gets_the_customers_pdf(world):
    client, session = world
    act_as(client, CUSTOMER)
    # A draft is never shown to the customer, and neither are mismatched or unknown ids.
    assert client.get(customer_url(DRAFT[3], DRAFT[0], DRAFT[2])).status_code == 404
    assert client.get(customer_url(OTHER_REVISION)).status_code == 404
    assert client.get(customer_url(uuid4())).status_code == 404
    assert client.get(customer_url(REVISIONS[1], uuid4())).status_code == 404
    assert client.get(customer_url(REVISIONS[1], quotation=uuid4())).status_code == 404

    for subject in ("pdf_x", ADMIN_A, "pdf_sales"):
        act_as(client, subject)
        assert client.get(customer_url(REVISIONS[1])).status_code == 404, subject
    act_as(client, None)
    assert client.get(customer_url(REVISIONS[1])).status_code in {401, 403}

    # A suspended owner is refused too.
    owner = session.query(AppUser).filter_by(clerk_subject=CUSTOMER).one()
    owner.is_suspended = True
    session.commit()
    act_as(client, CUSTOMER)
    assert client.get(customer_url(REVISIONS[1])).status_code in {401, 403}


def test_company_staff_get_their_own_revisions_including_drafts(world):
    client, _ = world
    for subject in (ADMIN_A, "pdf_sales"):
        act_as(client, subject)
        response = client.get(company_url(REVISIONS[1]))
        assert response.status_code == 200, subject
        assert response.headers["content-type"] == "application/pdf"
        assert response.headers["cache-control"] == "no-store"
        assert "Revision: 2" in text_of(response) and "500000.00" in text_of(response)
        assert client.get(company_url(REVISIONS[0])).status_code == 200
    # The company can read its own draft, which the customer never can.
    act_as(client, ADMIN_A)
    draft = client.get(company_url(DRAFT[3], delivery=DRAFT[1], quotation=DRAFT[2]))
    assert draft.status_code == 200 and "Not stated" in text_of(draft)


def test_everyone_else_is_refused_the_company_pdf(world):
    client, _ = world
    url = company_url(REVISIONS[1])
    # Not a member, a technician, a suspended member and a customer: all refused.
    for subject in (ADMIN_B, "pdf_tech", "pdf_off", CUSTOMER, "pdf_x"):
        act_as(client, subject)
        assert client.get(url).status_code == 403, subject
    act_as(client, None)
    assert client.get(url).status_code in {401, 403}

    # Another company's admin cannot reach it by naming their own company either.
    act_as(client, ADMIN_B)
    assert client.get(company_url(REVISIONS[1], company=COMPANY_B)).status_code == 404

    # Mismatched or unknown ids are not found, even for the right company.
    act_as(client, ADMIN_A)
    assert client.get(company_url(OTHER_REVISION)).status_code == 404
    assert client.get(company_url(uuid4())).status_code == 404
    assert client.get(company_url(REVISIONS[1], quotation=uuid4())).status_code == 404
    assert client.get(company_url(REVISIONS[1], delivery=uuid4())).status_code == 404
    assert client.get(company_url(REVISIONS[1], delivery=DRAFT[1])).status_code == 404
