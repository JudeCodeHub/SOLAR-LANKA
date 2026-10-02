"""Test-only: move a confirmed site visit into the past so it can be completed (the API refuses past slots).

Run with the backend's Python; the database address comes from E2E_DATABASE_URL.
"""

import os
import sys

import psycopg

url = os.environ["E2E_DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://")
with psycopg.connect(url, autocommit=True) as connection:
    connection.execute(
        "UPDATE site_visits SET confirmed_starts_at = now() - interval '2 hours', "
        "confirmed_ends_at = now() - interval '5 minutes' WHERE id = %s AND status = 'confirmed'",
        (sys.argv[1],),
    )
