"""Local identity records; clerk_subject must come from verified token claims."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, String, UniqueConstraint, false, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.permissions import Role
from app.core.value_types import new_entity_id
from app.db.base import Base


class AppUser(Base):
    """Link an application identity to Clerk without storing authentication secrets."""

    __tablename__ = "app_users"
    __table_args__ = (
        UniqueConstraint("clerk_subject", name="uq_app_users_clerk_subject"),
        CheckConstraint("role IN ('customer', 'platform_admin')", name="ck_app_users_role"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=new_entity_id)
    clerk_subject: Mapped[str] = mapped_column(String(255), nullable=False)
    # Company staff permissions come from memberships, never public provisioning.
    role: Mapped[str] = mapped_column(
        String(32), nullable=False, default=Role.CUSTOMER.value, server_default="customer"
    )
    is_suspended: Mapped[bool] = mapped_column(
        nullable=False, default=False, server_default=false()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
