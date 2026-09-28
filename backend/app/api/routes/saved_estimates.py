"""Customer-only estimate creation with independent historical snapshots."""

from copy import deepcopy
from datetime import UTC
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.schemas.estimate_preview import EstimatePreviewResponse
from app.api.schemas.estimator_inputs import EstimatorInputs
from app.core.permissions import Action, Scope, required_scopes
from app.db.session import get_session
from app.models.saved_estimate import SavedEstimate
from app.models.user import AppUser
from app.services.estimates import build_preview, latest_published_config

router = APIRouter(prefix="/users/me/estimates", tags=["saved estimates"])


class SavedEstimateCreated(BaseModel):
    id: UUID
    estimate: EstimatePreviewResponse


def require_estimate_owner(
    user: Annotated[AppUser, Depends(require_local_user)],
) -> AppUser:
    if Scope.OWNER not in required_scopes(Action.ESTIMATE_SAVE, user.role):
        raise HTTPException(403)
    return user


@router.post("", status_code=201, response_model=SavedEstimateCreated)
def save_estimate(
    body: EstimatorInputs,
    user: Annotated[AppUser, Depends(require_estimate_owner)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> SavedEstimateCreated:
    response.headers["Cache-Control"] = "no-store"
    config = latest_published_config(session)
    if config is None:
        raise HTTPException(503)
    try:
        preview = build_preview(body, config)
    except ValueError:
        raise HTTPException(503) from None
    snapshot = {
        "id": str(config.id),
        "scenario": config.scenario,
        "version": config.version,
        "published_at": config.published_at.astimezone(UTC).isoformat(),
        "assumptions": deepcopy(config.assumptions),
        "source_metadata": deepcopy(config.source_metadata),
    }
    saved = SavedEstimate(
        user_id=user.id,
        config_version_id=config.id,
        input_snapshot=body.model_dump(mode="json"),
        configuration_snapshot=snapshot,
        result_snapshot=preview.model_dump(mode="json"),
    )
    session.add(saved)
    session.commit()
    return SavedEstimateCreated(id=saved.id, estimate=preview)
