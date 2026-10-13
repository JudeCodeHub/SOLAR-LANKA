"""Make one Clerk user the platform administrator; a second is always refused."""

import sys

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database_config import DatabaseSettings
from app.core.permissions import Role
from app.db.session import create_database_engine
from app.models.user import AppUser


class AdminError(ValueError):
    """The change was refused; the message says why."""


def make_admin(session: Session, clerk_user_id: str) -> None:
    clerk_user_id = clerk_user_id.strip()
    if not clerk_user_id.startswith("user_"):
        raise AdminError("A Clerk user id starts with user_ (Clerk dashboard, Users).")
    session.execute(select(func.pg_advisory_xact_lock(7_301)))
    other = session.scalar(
        select(func.count())
        .select_from(AppUser)
        .where(AppUser.role == Role.PLATFORM_ADMIN.value, AppUser.clerk_subject != clerk_user_id)
    )
    if other:
        raise AdminError("A platform administrator already exists; there can only be one.")
    user = session.scalars(
        select(AppUser).where(AppUser.clerk_subject == clerk_user_id)
    ).one_or_none()
    if user is None:
        session.add(AppUser(clerk_subject=clerk_user_id, role=Role.PLATFORM_ADMIN.value))
    else:
        user.role = Role.PLATFORM_ADMIN.value


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python -m app.make_admin CLERK_USER_ID")
    engine = create_database_engine(DatabaseSettings())
    try:
        with Session(engine) as session:
            try:
                make_admin(session, sys.argv[1])
            except AdminError as error:
                raise SystemExit(str(error)) from error
            session.commit()
        print(f"{sys.argv[1]} is now the platform administrator.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
