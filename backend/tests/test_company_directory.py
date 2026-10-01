"""The public directory is paged, filterable, and lists approved companies only."""

import pytest
from sqlalchemy import select

from app.models.company import Company
from app.seed_demo import DEMO_COMPANIES, seed_demo

pytestmark = pytest.mark.database

SUNBIRD, MOONLEAF, LOTUS = (name for _, name in DEMO_COMPANIES)


@pytest.fixture
def directory(database_client, database_session):
    seed_demo(database_session, environment="test")
    database_session.commit()
    return database_client, database_session


def names(response):
    assert response.status_code == 200, response.json()
    return [item["name"] for item in response.json()["items"]]


def test_demo_directory_lists_every_approved_company_in_name_order(directory):
    client, _ = directory
    response = client.get("/public/companies")
    assert response.json()["total"] == 3
    assert names(response) == sorted([SUNBIRD, MOONLEAF, LOTUS])
    first = response.json()["items"][0]
    assert first["declared_credentials"] is not None
    assert response.headers["cache-control"] == "no-store"


def test_pagination_reports_the_total_beyond_the_page(directory):
    client, _ = directory
    page = client.get("/public/companies?limit=2").json()
    assert (len(page["items"]), page["total"], page["limit"], page["offset"]) == (2, 3, 2, 0)
    rest = client.get("/public/companies?limit=2&offset=2").json()
    assert (len(rest["items"]), rest["total"]) == (1, 3)
    assert {i["name"] for i in page["items"]} | {i["name"] for i in rest["items"]} == {
        SUNBIRD,
        MOONLEAF,
        LOTUS,
    }


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("district=Colombo", [SUNBIRD]),
        ("district=Kandy", [MOONLEAF]),
        ("district=Galle", [LOTUS]),
        ("service=battery_installation", [MOONLEAF]),
        ("service=maintenance", [LOTUS, SUNBIRD]),
        ("service=installation", [LOTUS, MOONLEAF, SUNBIRD]),
        ("district=Galle&service=maintenance", [LOTUS]),
        ("district=Colombo&service=repair", []),
        ("district=Jaffna", []),
    ],
)
def test_filters_combine_and_match_exactly(directory, query, expected):
    client, _ = directory
    response = client.get(f"/public/companies?{query}")
    assert names(response) == sorted(expected)
    assert response.json()["total"] == len(expected)


def test_unapproved_companies_are_never_listed_or_counted(directory):
    client, session = directory
    for company in session.scalars(select(Company).where(Company.name == LOTUS)):
        company.publication_status = "pending"
    session.commit()
    response = client.get("/public/companies")
    assert response.json()["total"] == 2
    assert LOTUS not in names(response)
    assert names(client.get("/public/companies?district=Galle")) == []


@pytest.mark.parametrize(
    "query", ["district=Atlantis", "service=teleportation", "colour=red", "limit=0", "limit=101"]
)
def test_invalid_or_unknown_parameters_are_rejected(directory, query):
    client, _ = directory
    assert client.get(f"/public/companies?{query}").status_code == 422
