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

PUCSL_SCHEMES = {
    "title": "Rooftop solar PV connection schemes",
    "publisher": "Public Utilities Commission of Sri Lanka",
    "url": "https://www.pucsl.gov.lk/rooftop-solar-pv-connection-schemes/",
    "accessed_on": CHECKED.isoformat(),
}
PUCSL_TARIFFS = {
    "title": "End-user tariff decisions",
    "publisher": "Public Utilities Commission of Sri Lanka",
    "url": "https://www.pucsl.gov.lk/end-user-tariff-decisions/",
    "accessed_on": CHECKED.isoformat(),
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

# (category, slug, title, summary, body, sources, time-sensitive)
ARTICLES = (
    (
        "solar-basics",
        "how-rooftop-solar-works",
        "How rooftop solar works",
        "Panels make direct current, an inverter turns it into the alternating current your home uses.",
        "Sunlight falling on a solar panel makes direct current (DC).\n\n"
        "An inverter changes that into alternating current (AC), which is what your lights and "
        "appliances use. The electricity your home uses first comes from the panels while the sun "
        "shines. Anything you use beyond that still comes from the grid.\n\n"
        "A grid-connected system has no battery. When the grid is down, a basic grid-connected "
        "inverter switches off for safety, so panels alone do not keep the lights on during a power cut.",
        [SEA],
        False,
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
    ),
    (
        "costs-and-tariffs",
        "net-metering-and-other-schemes",
        "Net metering and other connection schemes",
        "Connection schemes decide how energy you send to the grid is counted. They can change.",
        "When a solar system makes more than your home uses, the extra goes to the grid. How that "
        "extra energy is counted depends on the connection scheme your system is approved under.\n\n"
        "Under net metering the energy you send to the grid is banked as credit against the energy "
        "you take, rather than paid out in cash. Other schemes, such as net accounting and net plus, "
        "count and pay for exported energy differently.\n\n"
        "The schemes on offer, their terms and their prices are set by the regulator and have been "
        "revised before. This article explains the idea only. Before you decide, read the regulator's "
        "current page listed below, and ask your installer which scheme your quotation assumes.",
        [PUCSL_SCHEMES],
        True,
    ),
    (
        "costs-and-tariffs",
        "understanding-your-electricity-bill",
        "Understanding your electricity bill",
        "Why bills have blocks, fixed charges and changing rates, and why savings are a range.",
        "A household electricity bill is usually built from the units you used, charged in blocks "
        "at different rates, plus a fixed charge. The rates, the block sizes and the fixed charges "
        "are set by the regulator and can be revised.\n\n"
        "That is why a saving worked out today is a planning estimate, not a promise: if rates "
        "change, so does the saving. A good estimate shows a range and says which tariff and which "
        "date it assumed.\n\n"
        "For the current rates, read the regulator's tariff decisions listed below. Do not rely on "
        "a figure quoted without a date.",
        [PUCSL_TARIFFS],
        True,
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
    for category, slug, title, summary, body, sources, time_sensitive in ARTICLES:
        if session.scalars(select(Article).where(Article.slug == slug)).first() is not None:
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
                reviewed_on=CHECKED,
                sources=sources,
                time_sensitive=time_sensitive,
                valid_as_of=CHECKED if time_sensitive else None,
                review_by=date(2027, 3, 28) if time_sensitive else None,
                is_sample=True,
                published_at=now,
            )
        )
