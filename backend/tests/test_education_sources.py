"""Only articles whose claims were read against their cited pages leave the sample label."""

from datetime import date

from app.seed_education import ARTICLES, VERIFIED


def test_verified_articles_cite_dated_https_sources_and_the_rest_stay_sample():
    verified = {a[1]: a for a in ARTICLES if a[7] is not None}
    assert sorted(verified) == [
        "how-rooftop-solar-works",
        "net-metering-and-other-schemes",
        "understanding-your-electricity-bill",
    ]
    for slug, article in verified.items():
        assert article[7] == VERIFIED == date(2026, 10, 5), slug
        sources = article[5]
        assert sources, slug
        for source in sources:
            assert source["url"].startswith("https://"), slug
            assert source["accessed_on"] == VERIFIED.isoformat(), slug
            assert source["publisher"] and source["title"], slug


def test_time_sensitive_articles_state_no_rates():
    for article in ARTICLES:
        if article[6]:
            assert "LKR" not in article[4] and "Rs" not in article[4]
