"""Company records and explicit company-scoped membership grants."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.value_types import new_entity_id
from app.db.base import Base


class Company(Base):
    __tablename__ = "companies"
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="ck_companies_name"),
        CheckConstraint(
            "publication_status IN ('draft', 'pending', 'approved', 'rejected')",
            name="ck_companies_publication_status",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    publication_status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="draft", server_default="draft"
    )
    service_districts: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")
    services: Mapped[list[str]] = mapped_column(JSONB, default=list, server_default="[]")
    declared_credentials: Mapped[list[dict[str, str]]] = mapped_column(
        JSONB, default=list, server_default="[]"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class CompanyMembership(Base):
    __tablename__ = "company_memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "company_id", name="uq_company_memberships_user_company"),
        CheckConstraint(
            "role IN ('company_admin', 'sales', 'technician')", name="ck_company_memberships_role"
        ),
        CheckConstraint("status IN ('active', 'suspended')", name="ck_company_memberships_status"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("app_users.id", ondelete="RESTRICT"), nullable=False
    )
    company_id: Mapped[UUID] = mapped_column(
        ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="active", server_default="active"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
