"""Public unsaved preview for the single supported net-metering scenario."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.schemas.estimate_preview import EstimatePreviewResponse
from app.api.schemas.estimator_inputs import EstimatorInputs
from app.db.session import get_session
from app.services.estimates import build_preview, latest_published_config

router = APIRouter(prefix="/estimates", tags=["estimates"])


@router.post("/preview", response_model=EstimatePreviewResponse)
def preview_estimate(
    body: EstimatorInputs,
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> EstimatePreviewResponse:
    """Calculate without identity, persistence, or a draft configuration."""
    response.headers["Cache-Control"] = "no-store"
    config = latest_published_config(session)
    if config is None:
        raise HTTPException(503)
    try:
        return build_preview(body, config)
    except ValueError:
        # A published configuration may be incomplete; do not expose its details.
        raise HTTPException(503) from None
