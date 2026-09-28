"""Public unsaved preview for the single supported net-metering scenario."""

from dataclasses import asdict
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas.estimate_preview import EstimatePreviewResponse, PublicSource
from app.api.schemas.estimator_inputs import EstimatorInputs
from app.core.estimator_engine import calculate_sizing
from app.core.estimator_finance import calculate_financial
from app.core.estimator_scenario import GRID_NET_METERING
from app.db.session import get_session
from app.models.estimator_config import EstimatorConfigVersion

router = APIRouter(prefix="/estimates", tags=["estimates"])


@router.post("/preview", response_model=EstimatePreviewResponse)
def preview_estimate(
    body: EstimatorInputs,
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> EstimatePreviewResponse:
    """Calculate without identity, persistence, or a draft configuration."""
    response.headers["Cache-Control"] = "no-store"
    config = session.scalars(
        select(EstimatorConfigVersion)
        .where(
            EstimatorConfigVersion.scenario == GRID_NET_METERING.identifier,
            EstimatorConfigVersion.status == "published",
        )
        .order_by(EstimatorConfigVersion.version.desc())
        .limit(1)
    ).one_or_none()
    if config is None:
        raise HTTPException(503)
    try:
        sizing = calculate_sizing(body, config)
        financial = calculate_financial(body, config)
    except ValueError:
        # A published configuration may be incomplete; do not expose its details.
        raise HTTPException(503) from None
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
