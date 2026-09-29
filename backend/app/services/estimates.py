"""Use one calculation and response path for public previews and saved estimates."""

from dataclasses import asdict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas.estimate_preview import EstimatePreviewResponse, PublicSource
from app.api.schemas.estimator_inputs import EstimatorInputs
from app.core.estimator_engine import calculate_sizing
from app.core.estimator_finance import calculate_financial
from app.core.estimator_scenario import GRID_NET_METERING
from app.models.estimator_config import EstimatorConfigVersion


def latest_published_config(session: Session) -> EstimatorConfigVersion | None:
    return session.scalars(
        select(EstimatorConfigVersion)
        .where(
            EstimatorConfigVersion.scenario == GRID_NET_METERING.identifier,
            EstimatorConfigVersion.status == "published",
            EstimatorConfigVersion.is_archived.is_(False),
        )
        .order_by(EstimatorConfigVersion.version.desc())
        .limit(1)
    ).one_or_none()


def build_preview(
    inputs: EstimatorInputs, config: EstimatorConfigVersion
) -> EstimatePreviewResponse:
    sizing = calculate_sizing(inputs, config)
    financial = calculate_financial(inputs, config)
    sources = {}
    for topic in ("yield", "tariff", "cost"):
        raw = config.source_metadata.get(topic)
        if not isinstance(raw, dict):
            continue
        public = {key: raw.get(key) for key in PublicSource.model_fields if key != "url"}
        if topic != "cost":
            public["url"] = raw.get("url")
        sources[topic] = PublicSource.model_validate(public)
    return EstimatePreviewResponse(
        scenario=config.scenario,
        config_id=config.id,
        config_version=config.version,
        sizing=asdict(sizing),
        financial=asdict(financial),
        sources=sources,
        disclaimer="Planning estimate only; not an installation design or savings guarantee.",
    )
