"""Shared metadata for domain models and Alembic autogeneration."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """All future SQLAlchemy domain models inherit from this base."""
