"""Reviewed, sourced content: time-sensitive articles are identifiable and go stale visibly."""

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import select, text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.education import Article
from app.models.user import AppUser
from app.seed_education import ARTICLES, CATEGORIES, seed_education

pytestmark = pytest.mark.database

SOURCE = {
    "title": "Tariff decisions",
    "publisher": "Regulator",
    "url": "https://example.org/tariffs",
    "accessed_on": "2026-09-28",
}


def test_review_and_time_sensitivity(database_client, database_session):
    client, session = database_client, database_session
    session.add_all(
        [
            AppUser(clerk_subject="rv_author", role="platform_admin"),
            AppUser(clerk_subject="rv_reviewer", role="platform_admin"),
        ]
    )
    session.commit()

    def act_as(subject: str | None) -> None:
        if subject is None:
            client.app.dependency_overrides.pop(require_identity, None)
        else:
            client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
                subject, "session_test"
            )

    act_as("rv_author")
    category = client.post(
        "/admin/education/categories", json={"slug": "tariffs", "name": "Tariffs"}
    ).json()
    base = {"category_id": category["id"], "summary": "How tariffs work.", "body": "Rates change."}
    today = datetime.now(UTC).date()

    # Time-sensitive content must say what date it is true for and when to check it again.
    for bad in (
        {"time_sensitive": True},
        {"time_sensitive": True, "valid_as_of": str(today)},
        {"time_sensitive": True, "valid_as_of": str(today), "review_by": str(today)},
    ):
        made = client.post(
            "/admin/education/articles",
            json={**base, "slug": "t", "title": "T", "sources": [SOURCE], **bad},
        )
        assert made.status_code == 422, bad
    assert (
        client.post(
            "/admin/education/articles",
            json={**base, "slug": "t", "title": "T", "sources": [{**SOURCE, "url": "nope"}]},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/admin/education/articles",
            json={**base, "slug": "t", "title": "T", "sources": [SOURCE] * 11},
        ).status_code
        == 422
    )

    tariff = client.post(
        "/admin/education/articles",
        json={
            **base,
            "slug": "tariff-blocks",
            "title": "Tariff blocks",
            "sources": [SOURCE],
            "time_sensitive": True,
            "valid_as_of": str(today),
            "review_by": str(today + timedelta(days=180)),
        },
    ).json()
    plain = client.post(
        "/admin/education/articles",
        json={**base, "slug": "how-panels-work", "title": "How panels work", "sources": [SOURCE]},
    ).json()
    unsourced = client.post(
        "/admin/education/articles", json={**base, "slug": "unsourced", "title": "Unsourced"}
    ).json()

    # Review rules: not by the author, not without a source, and edits void a review.
    aid = f"/admin/education/articles/{tariff['id']}"
    assert client.post(f"{aid}/review").status_code == 409  # the author cannot review their own
    act_as("rv_reviewer")
    assert client.post(f"/admin/education/articles/{unsourced['id']}/review").status_code == 409
    reviewed = client.post(f"{aid}/review").json()
    assert reviewed["reviewed_on"] == str(today) and reviewed["reviewer_id"]
    act_as("rv_author")
    changed = {
        **base,
        "slug": "tariff-blocks",
        "title": "Tariff blocks",
        "sources": [SOURCE],
        "body": "Rates change, so check the date.",
        "time_sensitive": True,
        "valid_as_of": str(today),
        "review_by": str(today + timedelta(days=180)),
    }
    assert client.put(aid, json=changed).json()["reviewer_id"] is None  # new words, no review
    assert client.post(f"{aid}/publish").status_code == 409
    act_as("rv_reviewer")
    for item in (tariff, plain):
        assert client.post(f"/admin/education/articles/{item['id']}/review").status_code == 200
    act_as("rv_author")
    for item in (tariff, plain):
        assert client.post(f"/admin/education/articles/{item['id']}/publish").status_code == 200

    # TIME-SENSITIVE ARTICLES ARE IDENTIFIABLE in lists and in detail, with their date and sources.
    act_as(None)
    items = {i["slug"]: i for i in client.get("/education/articles").json()["items"]}
    assert items["tariff-blocks"]["time_sensitive"] is True
    assert items["tariff-blocks"]["valid_as_of"] == str(today)
    assert items["tariff-blocks"]["review_overdue"] is False
    assert (
        items["how-panels-work"]["time_sensitive"] is False
        and items["how-panels-work"]["valid_as_of"] is None
    )
    detail = client.get("/education/articles/tariff-blocks").json()
    assert detail["sources"][0]["url"] == "https://example.org/tariffs"
    assert detail["reviewed_on"] == str(today) and detail["review_by"] == str(
        today + timedelta(days=180)
    )
    assert "reviewer_id" not in detail and "author_id" not in detail  # no account ids in public

    # Once its review date passes, it is shown as overdue rather than quietly kept as current.
    row = session.scalars(select(Article).where(Article.slug == "tariff-blocks")).one()
    row.review_by = date.today() - timedelta(days=1)
    row.valid_as_of = date.today() - timedelta(days=200)
    session.commit()
    stale = client.get("/education/articles/tariff-blocks").json()
    assert stale["review_overdue"] is True and stale["time_sensitive"] is True

    # The database holds the rules for direct writes.
    for sql, name in (
        (
            "UPDATE articles SET reviewer_id = NULL WHERE slug = 'how-panels-work'",
            "ck_articles_published_reviewed",
        ),
        (
            "UPDATE articles SET reviewer_id = author_id WHERE slug = 'how-panels-work'",
            "ck_articles_reviewer_differs",
        ),
        (
            "UPDATE articles SET valid_as_of = NULL WHERE slug = 'tariff-blocks'",
            "ck_articles_time_sensitive",
        ),
    ):
        session.execute(text("SAVEPOINT s"))
        with pytest.raises(Exception, match=name):
            session.execute(text(sql))
        session.execute(text("ROLLBACK TO SAVEPOINT s"))


def test_demonstration_content_is_reviewed_and_the_tariff_articles_are_marked(
    database_client, database_session
):
    session = database_session
    author = AppUser(clerk_subject="e2e_platform_admin", role="platform_admin")
    reviewer = AppUser(clerk_subject="e2e_content_reviewer", role="platform_admin")
    session.add_all([author, reviewer])
    session.commit()
    seed_education(session)
    session.commit()
    seed_education(session)  # repeatable
    session.commit()
    rows = session.scalars(select(Article)).all()
    assert len(rows) == len(ARTICLES) == 7
    assert all(a.status == "published" and a.reviewer_id == reviewer.id and a.sources for a in rows)
    assert {article[0] for article in ARTICLES} == {slug for slug, *_ in CATEGORIES}
    marked = {a.slug for a in rows if a.time_sensitive}
    assert marked == {"net-metering-and-other-schemes", "understanding-your-electricity-bill"}
    assert all(a.valid_as_of and a.review_by for a in rows if a.time_sensitive)
    for a in rows:
        if "tariff" in a.slug or "metering" in a.slug or "bill" in a.slug:
            assert a.time_sensitive, a.slug
    body = " ".join(a.body for a in rows)
    assert "LKR" not in body and "per unit" not in body  # no invented tariff figures
