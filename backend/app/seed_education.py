"""Fictional demonstration articles: reviewed, sourced, with the time-sensitive ones marked."""
# ruff: noqa: E501 -- readable article text is kept on long lines

from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.education import Article, EducationCategory
from app.models.user import AppUser

AUTHOR = "e2e_platform_admin"
REVIEWER = "e2e_content_reviewer"
CHECKED = date(2026, 9, 28)

# Articles whose claims were each read against their cited pages carry this date; the rest stay sample.
VERIFIED = date(2026, 10, 5)
REVIEW_BY = date(2027, 4, 5)

PUCSL_SCHEMES = {
    "title": "Rooftop solar PV connection schemes",
    "publisher": "Public Utilities Commission of Sri Lanka",
    "url": "https://www.pucsl.gov.lk/rooftop-solar-pv-connection-schemes/",
    "accessed_on": VERIFIED.isoformat(),
}
PUCSL_FEED_IN = {
    "title": "Decision on Feed in Tariffs, effective 25 August 2026",
    "publisher": "Public Utilities Commission of Sri Lanka",
    "url": "https://www.pucsl.gov.lk/wp-content/uploads/2026/08/Full-Final-Decision-on-Feed-in-Tariffs-August-2026.pdf",
    "accessed_on": VERIFIED.isoformat(),
}
PUCSL_TARIFFS = {
    "title": "End-user tariff decisions",
    "publisher": "Public Utilities Commission of Sri Lanka",
    "url": "https://www.pucsl.gov.lk/end-user-tariff-decisions/",
    "accessed_on": VERIFIED.isoformat(),
}
PUCSL_DOMESTIC = {
    "title": "Domestic tariff (the page shows no revision date)",
    "publisher": "Public Utilities Commission of Sri Lanka",
    "url": "https://www.pucsl.gov.lk/?p=8390",
    "accessed_on": VERIFIED.isoformat(),
}
DOE_PV_BASICS = {
    "title": "Solar photovoltaic technology basics",
    "publisher": "US Department of Energy, Solar Energy Technologies Office",
    "url": "https://www.energy.gov/eere/solar/solar-photovoltaic-technology-basics",
    "accessed_on": VERIFIED.isoformat(),
}
DOE_INVERTERS = {
    "title": "Solar integration: inverters and grid services basics",
    "publisher": "US Department of Energy, Solar Energy Technologies Office",
    "url": "https://www.energy.gov/eere/solar/solar-integration-inverters-and-grid-services-basics",
    "accessed_on": VERIFIED.isoformat(),
}
SEA = {
    "title": "Soorya Bala Sangramaya programme",
    "publisher": "Sri Lanka Sustainable Energy Authority",
    "url": "https://energy.gov.lk/en/soorya-bala-sangramaya",
    "accessed_on": CHECKED.isoformat(),
}

CATEGORIES = (
    ("solar-basics", "Solar basics", "How a rooftop system works, in plain language.", 1),
    (
        "costs-and-tariffs",
        "Costs and tariffs",
        "What you pay, what you save, and what can change.",
        2,
    ),
    ("safety-and-maintenance", "Safety and maintenance", "Looking after a system without risk.", 3),
)

# (category, slug, title, summary, body, sources, time-sensitive, verified on)
ARTICLES = (
    (
        "solar-basics",
        "how-rooftop-solar-works",
        "How rooftop solar works",
        "Panels make direct current, an inverter turns it into the alternating current your home uses.",
        "Sunlight falling on a solar panel's cells is turned into direct current (DC) electricity.\n\n"
        "An inverter changes DC into alternating current (AC), the kind of electricity the grid uses "
        "and that the appliances in your home run on.\n\n"
        "A rooftop system connected to the grid can send the electricity it makes beyond what your "
        "home uses to the grid. How that extra energy is counted depends on your connection scheme: "
        "see the article on connection schemes.\n\n"
        "Inverters connected to the grid are designed to disconnect and shut down when the grid is "
        "disrupted for a long time or by a large amount, so a basic grid-connected system does not "
        "keep the lights on during a power cut. If you need power during a cut, ask your installer "
        "what your system does.",
        [DOE_PV_BASICS, DOE_INVERTERS, PUCSL_SCHEMES],
        False,
        VERIFIED,
    ),
    (
        "solar-basics",
        "panels-and-inverters-explained",
        "Panels and inverters explained",
        "What wattage and efficiency mean, and what an inverter's capacity is for.",
        "Panel wattage is how much power one panel can make in standard test conditions. "
        "Efficiency is the share of sunlight a panel turns into electricity. A higher wattage panel "
        "is not always more efficient: it may simply be larger.\n\n"
        "An inverter has a capacity in kilowatts. It should suit the total size of the panels you "
        "connect, which an installer works out for your roof.\n\n"
        "Compare products on the same units, and treat a missing value as unknown, not as zero.",
        [SEA],
        False,
        None,
    ),
    (
        "solar-basics",
        "reading-a-datasheet",
        "Reading a product datasheet",
        "The few lines of a datasheet that matter when you compare two products.",
        "A datasheet is the manufacturer's own description of a product. Look for the rated power, "
        "the efficiency, the warranty for the product and for its performance, and the operating "
        "temperature range.\n\n"
        "Check that two products are compared under the same conditions, and read the warranty "
        "terms rather than only the number of years.",
        [SEA],
        False,
        None,
    ),
    (
        "costs-and-tariffs",
        "net-metering-and-other-schemes",
        "Net metering and other connection schemes",
        "Connection schemes decide how energy you send to the grid is counted. They can change.",
        "When a solar system makes more than your home uses, the extra goes to the grid. How that "
        "extra energy is counted depends on the connection scheme your system is approved under.\n\n"
        "The regulator's page describes four schemes. Under net metering the excess is not paid for "
        "in cash: it is banked, for up to 10 years according to the page, and counted against the "
        "energy you take. Under net accounting you are paid for the electricity you export, at a "
        "feed-in tariff. Under net plus, two meters measure import and export separately and you are "
        "paid for all the electricity you generate, whatever you use. Net plus plus is a further "
        "arrangement that treats the system as a power plant, for installations above a home's "
        "contract demand.\n\n"
        "The schemes and what they pay change. The regulator's August 2026 decision on feed-in "
        "tariffs applies from 25 August 2026 until the next revision, and it quotes the National "
        'Electricity Policy: new on-grid rooftop agreements are on a "net plus" basis, a term the '
        "decision explains as the two-meter connection arrangement.\n\n"
        "This article explains the idea only and gives no rate. Read the regulator's pages listed "
        "below for the current terms, and ask your installer which scheme your quotation assumes and "
        "whether it is open to new connections.",
        [PUCSL_SCHEMES, PUCSL_FEED_IN],
        True,
        VERIFIED,
    ),
    (
        "costs-and-tariffs",
        "understanding-your-electricity-bill",
        "Understanding your electricity bill",
        "Why bills have blocks, fixed charges and changing rates, and why savings are a range.",
        "A household electricity bill is built from the units you used, charged in blocks at "
        "different rates, plus a fixed charge. The regulator's domestic tariff counts blocks over a "
        "30 day billing period and has a separate scale for households using 60 units a month or "
        "less. The rates, the block sizes and the fixed charges are set by the regulator, whose "
        "tariff decisions have been revised many times.\n\n"
        "That is why a saving worked out today is a planning estimate, not a promise: if rates "
        "change, so does the saving. A good estimate shows a range and says which tariff and which "
        "date it assumed.\n\n"
        "This article gives no rates. For the current ones, read the regulator's pages listed "
        "below, and do not rely on a figure quoted without a date.",
        [PUCSL_DOMESTIC, PUCSL_TARIFFS],
        True,
        VERIFIED,
    ),
    (
        "safety-and-maintenance",
        "keeping-panels-clean-and-safe",
        "Keeping panels clean, safely",
        "Dust lowers output a little. Cleaning is never worth a fall or an electric shock.",
        "Dust, bird droppings and leaves can lower what panels produce. If you can see a layer on "
        "panels from the ground, ask your installer how often to have them cleaned.\n\n"
        "Never climb onto a roof to clean panels, never use a high-pressure jet, and never touch "
        "cables or the inverter. Panels make electricity whenever there is light, even when the "
        "rest of the system is switched off.",
        [SEA],
        False,
        None,
    ),
    (
        "safety-and-maintenance",
        "when-to-call-a-technician",
        "When to call a technician",
        "What you can safely look at yourself, and what needs a qualified person straight away.",
        "You can safely note any code on the inverter's display, take a photo from a safe distance, "
        "and see whether the rest of the house has power.\n\n"
        "Call a qualified technician if a code stays on, the output drops sharply, or anything looks "
        "damaged. If you smell burning, see sparks or smoke, or feel unusual heat, do not touch the "
        "equipment: keep people away and call a qualified technician or the emergency services.",
        [SEA],
        False,
        None,
    ),
)


def seed_education(session: Session) -> None:
    """Add the demonstration content once; needs the two demo administrators to exist."""
    author = session.scalars(select(AppUser).where(AppUser.clerk_subject == AUTHOR)).first()
    reviewer = session.scalars(select(AppUser).where(AppUser.clerk_subject == REVIEWER)).first()
    if author is None or reviewer is None:
        return
    categories = {}
    for slug, name, description, position in CATEGORIES:
        category = session.scalars(
            select(EducationCategory).where(EducationCategory.slug == slug)
        ).first()
        if category is None:
            category = EducationCategory(
                slug=slug, name=name, description=description, position=position
            )
            session.add(category)
            session.flush()
        categories[slug] = category
    now = datetime.now(UTC)
    for category, slug, title, summary, body, sources, time_sensitive, verified_on in ARTICLES:
        existing = session.scalars(select(Article).where(Article.slug == slug)).first()
        if existing is not None:
            # A demo database seeded before the check gets the checked wording, only while still sample.
            if verified_on is not None and existing.is_sample:
                existing.body, existing.sources, existing.summary = body, sources, summary
                existing.reviewed_on, existing.is_sample = verified_on, False
                existing.valid_as_of = verified_on if time_sensitive else None
                existing.review_by = REVIEW_BY if time_sensitive else None
            continue
        session.add(
            Article(
                category_id=categories[category].id,
                slug=slug,
                title=title,
                summary=summary,
                body=body,
                status="published",
                author_id=author.id,
                reviewer_id=reviewer.id,
                reviewed_on=verified_on or CHECKED,
                sources=sources,
                time_sensitive=time_sensitive,
                valid_as_of=(verified_on or CHECKED) if time_sensitive else None,
                review_by=(REVIEW_BY if verified_on else date(2027, 3, 28))
                if time_sensitive
                else None,
                is_sample=verified_on is None,
                published_at=now,
            )
        )
