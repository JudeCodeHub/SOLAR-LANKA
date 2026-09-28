"""Estimator references must not silently become invented calculation values."""

from datetime import date

from app.core.estimator_sources import COST_SOURCE, ESTIMATOR_SOURCES, TARIFF_SOURCE, YIELD_SOURCE


def test_estimator_references_have_provenance_and_no_unsourced_values() -> None:
    assert {source.topic for source in ESTIMATOR_SOURCES} == {"yield", "tariff", "cost"}
    assert all(
        source.url.startswith("https://") and source.reviewed_on
        for source in ESTIMATOR_SOURCES
    )
    assert all(source.value is None and source.limitation for source in ESTIMATOR_SOURCES)
    assert YIELD_SOURCE.dataset_metadata_updated_on == date(2023, 1, 24)
    assert TARIFF_SOURCE.effective_from == date(2026, 5, 11)
    assert COST_SOURCE.effective_from is None
