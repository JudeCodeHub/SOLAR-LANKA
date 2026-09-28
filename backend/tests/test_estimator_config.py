"""Estimator configuration versions keep their assumptions and provenance together."""

from app.models.estimator_config import EstimatorConfigVersion


def test_estimator_version_schema_requires_source_snapshot() -> None:
    table = EstimatorConfigVersion.__table__
    assert {"scenario", "version", "assumptions", "source_metadata"} <= set(table.c.keys())
    assert not table.c.assumptions.nullable
    assert not table.c.source_metadata.nullable
    constraints = {
        constraint.name: str(constraint.sqltext)
        for constraint in table.constraints
        if hasattr(constraint, "sqltext")
    }
    assert "ck_estimator_config_sources" in constraints
    assert all(
        topic in constraints["ck_estimator_config_sources"]
        for topic in ("yield", "tariff", "cost")
    )
