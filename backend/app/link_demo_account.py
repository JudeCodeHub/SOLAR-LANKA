"""Development only: attach a Clerk user to a seeded demo person so a reviewer can sign in."""

import sys

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database_config import DatabaseSettings
from app.db.session import create_database_engine
from app.models.user import AppUser
from app.seed_demo import DEMO_CUSTOMER, DEMO_USERS
from app.seed_e2e import E2E_IDENTITIES

DEMO_SUBJECTS = frozenset(
    [subject for _, subject in DEMO_USERS]
    + [DEMO_CUSTOMER[1]]
    + [subject for _, subject, _, _ in E2E_IDENTITIES]
)


class LinkError(ValueError):
    """The link was refused; the message says why in words a reviewer can act on."""


def link_demo_account(session: Session, demo_subject: str, clerk_user_id: str) -> None:
    """Point a demo person at a Clerk user id; their role, company and records stay as seeded."""
    if demo_subject not in DEMO_SUBJECTS:
        raise LinkError(f"{demo_subject} is not a seeded demo person.")
    clerk_user_id = clerk_user_id.strip()
    if not clerk_user_id.startswith("user_"):
        raise LinkError("A Clerk user id starts with user_ (Clerk dashboard, Users).")
    demo = session.scalars(
        select(AppUser).where(AppUser.clerk_subject == demo_subject)
    ).one_or_none()
    if demo is None:
        raise LinkError("Run the demo seeds first (app.seed_demo and app.seed_e2e).")
    taken = session.scalars(
        select(AppUser).where(AppUser.clerk_subject == clerk_user_id)
    ).one_or_none()
    if taken is not None:
        raise LinkError(
            "That Clerk user already has an account here (signing in creates one). "
            "Link before the first sign-in, or use another Clerk user."
        )
    demo.clerk_subject = clerk_user_id


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python -m app.link_demo_account DEMO_SUBJECT CLERK_USER_ID")
    settings = DatabaseSettings()
    if settings.environment != "development":
        raise SystemExit("Linking demo accounts requires development mode")
    engine = create_database_engine(settings)
    try:
        with Session(engine) as session:
            try:
                link_demo_account(session, sys.argv[1], sys.argv[2])
            except LinkError as error:
                raise SystemExit(str(error)) from error
            session.commit()
        print(f"{sys.argv[1]} is now {sys.argv[2]}.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
