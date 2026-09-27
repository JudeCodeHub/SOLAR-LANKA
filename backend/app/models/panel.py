"""Sourced panel specifications. None means unknown; zero is never an unknown sentinel.

W = watts, V = volts, A = amperes, percent = 0..100. Warranty details preserve
manufacturer conditions verbatim as sourced text; never infer a duration or origin.
Media URLs belong to Product; uploaded-file associations follow in the media phase.
"""

from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Panel(Base):
    __tablename__ = "panels"
    __table_args__ = (
        CheckConstraint("wattage_w > 0", name="ck_panels_wattage"),
        CheckConstraint(
            "efficiency_percent > 0 AND efficiency_percent <= 100", name="ck_panels_efficiency"
        ),
        CheckConstraint("voltage_at_max_power_v > 0", name="ck_panels_vmp"),
        CheckConstraint("open_circuit_voltage_v > 0", name="ck_panels_voc"),
        CheckConstraint("current_at_max_power_a > 0", name="ck_panels_imp"),
        CheckConstraint("short_circuit_current_a > 0", name="ck_panels_isc"),
        CheckConstraint("product_warranty_years >= 0", name="ck_panels_product_warranty"),
        CheckConstraint("performance_warranty_years >= 0", name="ck_panels_performance_warranty"),
    )

    product_id: Mapped[UUID] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), primary_key=True
    )
    wattage_w: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    efficiency_percent: Mapped[Decimal | None] = mapped_column(Numeric(6, 3))
    cell_type: Mapped[str | None] = mapped_column(String(100))
    voltage_at_max_power_v: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    open_circuit_voltage_v: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    current_at_max_power_a: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    short_circuit_current_a: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    product_warranty_years: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    performance_warranty_years: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    warranty_details: Mapped[str | None] = mapped_column(Text)
    country_of_manufacture: Mapped[str | None] = mapped_column(String(100))
