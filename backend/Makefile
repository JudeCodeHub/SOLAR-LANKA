# Run from backend/, or use make -C backend <target> from the repository root.
# All Python commands use the project virtual environment.
# Default migration commands read backend/.env; test commands read backend/.env.test.
# Start PostgreSQL yourself before running online commands. No target manages Docker.
PYTHON := .venv/bin/python
ALEMBIC := $(PYTHON) -m alembic -c alembic.ini

.PHONY: help migrate migrate-test migration-current migration-test-current migration-history migration-new migration-down migration-sql test-migrations

help:
	@printf '%s\n' \
	  'make migrate                  Apply all revisions to the configured app database' \
	  'make migrate-test             Apply revisions to the guarded test database' \
	  'make migration-current        Show the app database revision' \
	  'make migration-test-current   Show the test database revision' \
	  'make migration-history        List revision history (no database required)' \
	  'make migration-new MESSAGE="add users"  Generate a migration; review before applying' \
	  'make migration-down           Undo ONE app revision; review possible data loss first' \
	  'make migration-sql            Print upgrade SQL without connecting' \
	  'make test-migrations          Check upgrade/rollback on a temporary empty test database'

migrate:
	$(ALEMBIC) upgrade head

migrate-test:
	$(ALEMBIC) -x environment=test upgrade head

migration-current:
	$(ALEMBIC) current

migration-test-current:
	$(ALEMBIC) -x environment=test current

migration-history:
	$(ALEMBIC) history

# Import new models in alembic/env.py before autogenerating their migrations.
# Inspect generated upgrade/downgrade operations; autogeneration is not a review.
migration-new:
	$(if $(strip $(MESSAGE)),,$(error Supply MESSAGE="describe the schema change"))
	$(ALEMBIC) revision --autogenerate -m "$(MESSAGE)"

# This explicit rollback command may discard data added by the reverted revision.
migration-down:
	$(ALEMBIC) downgrade -1

migration-sql:
	$(ALEMBIC) upgrade head --sql

# Requires the test container's local administrator and permission to create/drop
# a uniquely named temporary database. Existing development/test tables are untouched.
test-migrations:
	$(PYTHON) -m pytest --database tests/test_migrations.py
