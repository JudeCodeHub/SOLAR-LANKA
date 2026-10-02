"""Linking a Clerk user to a demo person keeps everything seeded and refuses unsafe links."""

from uuid import uuid4

import pytest
from sqlalchemy import select, text

from app.link_demo_account import DEMO_SUBJECTS, LinkError, link_demo_account
from app.models.user import AppUser


@pytest.mark.database
def test_link_moves_the_person_and_refuses_unsafe_links(database_connection, database_session):
    schema = f"link_{uuid4().hex}"
    database_connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    database_connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
    AppUser.__table__.create(database_connection)
    database_session.add_all(
        [
            AppUser(clerk_subject="demo_seed_customer", role="customer"),
            AppUser(clerk_subject="e2e_platform_admin", role="platform_admin"),
            AppUser(clerk_subject="user_already_signed_in", role="customer"),
        ]
    )
    database_session.commit()
    original = database_session.scalars(
        select(AppUser).where(AppUser.clerk_subject == "e2e_platform_admin")
    ).one()
    link_demo_account(database_session, "e2e_platform_admin", " user_2abc ")
    database_session.commit()
    database_session.refresh(original)
    assert original.clerk_subject == "user_2abc" and original.role == "platform_admin"
    for subject, clerk in (
        ("someone_else", "user_1"),
        ("demo_seed_customer", "not_a_clerk_id"),
        ("demo_seed_customer", "user_already_signed_in"),
        ("demo_seed_company_a", "user_9"),
    ):
        with pytest.raises(LinkError):
            link_demo_account(database_session, subject, clerk)
    assert "demo_seed_customer" in DEMO_SUBJECTS and "e2e_platform_admin" in DEMO_SUBJECTS
