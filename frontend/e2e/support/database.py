"""Create, drop or print the address of the disposable browser-test database in the test container.

Run with the backend's Python from `backend/`:  .venv/bin/python ../frontend/e2e/support/database.py create|drop|url
The address is built from the passwords in the root `.env`; `url` prints it for `export E2E_DATABASE_URL=$(...)`,
so run it only where the output is not shown or logged.
"""

import sys
from pathlib import Path
from urllib.parse import quote

import psycopg

NAME = "solarlanka_e2e"
env = dict(
    line.split("=", 1)
    for line in Path("../.env").read_text().splitlines()
    if "=" in line and not line.startswith("#")
)
password = env["POSTGRES_TEST_PASSWORD"].strip().strip('"').strip("'")
port = env.get("POSTGRES_TEST_PORT", "5433").strip()
base = f"//solarlanka_test:{quote(password, safe='')}@127.0.0.1:{port}"

if sys.argv[1] == "url":
    print(f"postgresql+psycopg:{base}/{NAME}")
else:
    with psycopg.connect(f"postgresql:{base}/postgres", autocommit=True) as connection:
        connection.execute(f"DROP DATABASE IF EXISTS {NAME}")
        if sys.argv[1] == "create":
            connection.execute(f"CREATE DATABASE {NAME}")
    print(sys.argv[1], "ok")
