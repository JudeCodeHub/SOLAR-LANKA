"""Drafts stay private, published articles are searchable, and only administrators publish."""

import pytest
from sqlalchemy import text

from app.core.auth import VerifiedIdentity, require_identity
from app.models.education import Article
from app.models.user import AppUser

pytestmark = pytest.mark.database


def article(category: str, slug: str, title: str, **over):
    return {
        "category_id": category,
        "slug": slug,
        "title": title,
        "summary": over.pop("summary", "A short summary."),
        "body": over.pop("body", "The full text."),
        **over,
    }


def test_education(database_client, database_session):
    client, session = database_client, database_session
    session.add_all(
        [AppUser(clerk_subject="ed_admin", role="platform_admin"), AppUser(clerk_subject="ed_user")]
    )
    session.commit()

    def act_as(subject: str | None) -> None:
        if subject is None:
            client.app.dependency_overrides.pop(require_identity, None)
        else:
            client.app.dependency_overrides[require_identity] = lambda: VerifiedIdentity(
                subject, "session_test"
            )

    base = "/admin/education"
    # Only platform administrators author; everyone else is refused and signed-out callers get 401.
    act_as(None)
    assert client.post(f"{base}/categories", json={"slug": "a", "name": "A"}).status_code == 401
    act_as("ed_user")
    assert client.post(f"{base}/categories", json={"slug": "a", "name": "A"}).status_code == 403
    assert client.get(f"{base}/articles").status_code == 403
    act_as("ed_admin")

    # Categories: slugs are addresses, so they are validated and unique.
    assert (
        client.post(f"{base}/categories", json={"slug": "Bad Slug", "name": "x"}).status_code == 422
    )
    solar = client.post(
        f"{base}/categories", json={"slug": "solar-basics", "name": "Solar basics", "position": 1}
    ).json()
    tariffs = client.post(
        f"{base}/categories", json={"slug": "tariffs", "name": "Tariffs", "position": 2}
    ).json()
    assert (
        client.post(f"{base}/categories", json={"slug": "tariffs", "name": "Again"}).status_code
        == 409
    )

    # Articles start as private drafts; the slug is unique; unknown categories are refused.
    assert (
        client.post(
            f"{base}/articles", json=article(str(solar["id"]), "Not A Slug", "x")
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"{base}/articles", json=article("00000000-0000-4000-8000-000000000000", "x", "x")
        ).status_code
        == 404
    )
    inverter = client.post(
        f"{base}/articles",
        json=article(
            solar["id"],
            "how-an-inverter-works",
            "How an inverter works",
            summary="Direct current becomes alternating current.",
            body="An inverter converts the direct current from panels into alternating current.",
        ),
    ).json()
    panels = client.post(
        f"{base}/articles",
        json=article(
            solar["id"],
            "choosing-panels",
            "Choosing panels",
            summary="Watts and efficiency.",
            body="Panel wattage and efficiency describe different things.",
        ),
    ).json()
    net = client.post(
        f"{base}/articles",
        json=article(
            tariffs["id"],
            "net-metering",
            "Net metering explained",
            summary="Exported energy earns credit.",
            body="Under net metering surplus energy is banked as credit.",
        ),
    ).json()
    assert inverter["status"] == "draft" and inverter["published_at"] is None
    assert (
        client.post(
            f"{base}/articles", json=article(solar["id"], "choosing-panels", "Duplicate")
        ).status_code
        == 409
    )
    empty = client.post(
        f"{base}/articles", json=article(solar["id"], "empty-draft", "Empty", summary="", body="")
    ).json()

    # DRAFTS REMAIN PRIVATE: no public route shows them, by list, search, address or count.
    act_as(None)
    assert client.get("/education/articles").json()["items"] == []
    assert client.get("/education/articles", params={"search": "inverter"}).json()["total"] == 0
    assert client.get(f"/education/articles/{inverter['slug']}").status_code == 404
    assert all(c["article_count"] == 0 for c in client.get("/education/categories").json())

    # Publishing needs a summary and text; edits only happen on drafts.
    act_as("ed_admin")
    assert client.post(f"{base}/articles/{empty['id']}/publish").status_code == 409
    for item in (inverter, panels, net):
        assert client.post(f"{base}/articles/{item['id']}/publish").status_code == 200
    assert client.post(f"{base}/articles/{inverter['id']}/publish").status_code == 409
    edited = {**article(solar["id"], inverter["slug"], "Changed")}
    assert client.put(f"{base}/articles/{inverter['id']}", json=edited).status_code == 409

    # PUBLISHED CONTENT IS SEARCHABLE, ranked, and filterable by category.
    act_as(None)
    listing = client.get("/education/articles").json()
    assert listing["total"] == 3 and {i["slug"] for i in listing["items"]} == {
        "how-an-inverter-works",
        "choosing-panels",
        "net-metering",
    }
    assert "body" not in listing["items"][0]
    found = client.get("/education/articles", params={"search": "inverter"}).json()
    assert [i["slug"] for i in found["items"]] == ["how-an-inverter-works"]
    assert [
        i["slug"]
        for i in client.get("/education/articles", params={"search": "converting currents"}).json()[
            "items"
        ]
    ] == ["how-an-inverter-works"]  # stemmed
    assert (
        client.get("/education/articles", params={"search": "banked credit"}).json()["items"][0][
            "slug"
        ]
        == "net-metering"
    )
    assert client.get("/education/articles", params={"search": "zebra"}).json()["total"] == 0
    assert (
        client.get("/education/articles", params={"search": '"unbalanced & | ('}).status_code == 200
    )  # odd input is safe
    assert {
        i["slug"]
        for i in client.get("/education/articles", params={"category": "tariffs"}).json()["items"]
    } == {"net-metering"}
    ranked = client.get("/education/articles", params={"search": "efficiency wattage"}).json()[
        "items"
    ]
    assert ranked[0]["slug"] == "choosing-panels"
    cats = {c["slug"]: c["article_count"] for c in client.get("/education/categories").json()}
    assert cats == {"solar-basics": 2, "tariffs": 1}
    assert client.get("/education/articles", params={"limit": 1}).json()["items"].__len__() == 1

    # Reading one gives the text and related articles from the same category only.
    one = client.get("/education/articles/how-an-inverter-works").json()
    assert one["body"].startswith("An inverter converts") and one["category_name"] == "Solar basics"
    assert [r["slug"] for r in one["related"]] == ["choosing-panels"]
    assert client.get("/education/articles/empty-draft").status_code == 404

    # Unpublishing makes it private again at once; archiving removes it from search too.
    act_as("ed_admin")
    assert client.post(f"{base}/articles/{inverter['id']}/unpublish").json()["status"] == "draft"
    act_as(None)
    assert client.get("/education/articles/how-an-inverter-works").status_code == 404
    assert client.get("/education/articles", params={"search": "inverter"}).json()["total"] == 0
    act_as("ed_admin")
    assert client.post(f"{base}/articles/{net['id']}/archive").json()["status"] == "archived"
    assert client.post(f"{base}/articles/{net['id']}/archive").status_code == 409
    act_as(None)
    assert client.get("/education/articles/net-metering").status_code == 404
    act_as("ed_admin")
    assert (
        client.put(
            f"{base}/articles/{inverter['id']}",
            json=article(
                solar["id"],
                inverter["slug"],
                "How an inverter works, revised",
                summary="s",
                body="b",
            ),
        ).status_code
        == 200
    )
    assert {a["status"] for a in client.get(f"{base}/articles").json()} == {
        "draft",
        "published",
        "archived",
    }
    assert [
        a["status"] for a in client.get(f"{base}/articles", params={"status": "archived"}).json()
    ] == ["archived"]

    # The database holds the rules even for a direct write.
    session.execute(text("SAVEPOINT s"))
    with pytest.raises(Exception, match="ck_articles_published_complete"):
        session.execute(
            text(
                "UPDATE articles SET body = '', published_at = now(), status = 'published' "
                "WHERE id = :i"
            ),
            {"i": empty["id"]},
        )
    session.execute(text("ROLLBACK TO SAVEPOINT s"))
    assert session.query(Article).count() == 4
