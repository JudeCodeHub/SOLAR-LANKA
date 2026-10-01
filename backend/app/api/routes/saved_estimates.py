"""Customer-only estimate creation with independent historical snapshots."""

from copy import deepcopy
from datetime import UTC
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.schemas.estimate_preview import EstimatePreviewResponse
from app.api.schemas.estimator_inputs import EstimatorInputs
from app.api.schemas.pagination import PageResponse, PaginationParams
from app.api.schemas.saved_estimates import (
    HistoricalConfiguration,
    SavedEstimateDetail,
    SavedEstimateSummary,
)
from app.core.permissions import Action, Scope, required_scopes
from app.core.request_protection import SAVED_ESTIMATE_WRITE, protect_user
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


def require_estimate_reader(
    user: Annotated[AppUser, Depends(require_local_user)],
) -> AppUser:
    if Scope.OWNER not in required_scopes(Action.ESTIMATE_READ, user.role):
        raise HTTPException(403)
    return user


def summary_for(saved: SavedEstimate) -> SavedEstimateSummary:
    result = EstimatePreviewResponse.model_validate(saved.result_snapshot)
    return SavedEstimateSummary(
        id=saved.id,
        created_at=saved.created_at,
        scenario=result.scenario,
        config_version=result.config_version,
        panel_count_minimum=result.sizing.panel_count.minimum,
        panel_count_maximum=result.sizing.panel_count.maximum,
        capacity_kwp_minimum=result.sizing.capacity_kwp.minimum,
        capacity_kwp_maximum=result.sizing.capacity_kwp.maximum,
    )


@router.get("", response_model=PageResponse[SavedEstimateSummary])
def list_saved_estimates(
    user: Annotated[AppUser, Depends(require_estimate_reader)],
    session: Annotated[Session, Depends(get_session)],
    pagination: Annotated[PaginationParams, Query()],
    response: Response,
) -> PageResponse[SavedEstimateSummary]:
    response.headers["Cache-Control"] = "no-store"
    total = (
        session.scalar(
            select(func.count()).select_from(SavedEstimate).where(SavedEstimate.user_id == user.id)
        )
        or 0
    )
    rows = session.scalars(
        select(SavedEstimate)
        .where(SavedEstimate.user_id == user.id)
        .order_by(SavedEstimate.created_at.desc(), SavedEstimate.id.desc())
        .limit(pagination.limit)
        .offset(pagination.offset)
    )
    return PageResponse[SavedEstimateSummary](
        limit=pagination.limit,
        offset=pagination.offset,
        total=total,
        items=[summary_for(saved) for saved in rows],
    )


@router.get("/{estimate_id}", response_model=SavedEstimateDetail)
def saved_estimate_detail(
    estimate_id: UUID,
    user: Annotated[AppUser, Depends(require_estimate_reader)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> SavedEstimateDetail:
    response.headers["Cache-Control"] = "no-store"
    saved = session.scalars(
        select(SavedEstimate).where(
            SavedEstimate.id == estimate_id,
            SavedEstimate.user_id == user.id,
        )
    ).one_or_none()
    if saved is None:
        raise HTTPException(404)
    estimate = EstimatePreviewResponse.model_validate(saved.result_snapshot)
    config = saved.configuration_snapshot
    return SavedEstimateDetail(
        id=saved.id,
        created_at=saved.created_at,
        inputs=EstimatorInputs.model_validate(saved.input_snapshot),
        configuration=HistoricalConfiguration(
            id=config["id"],
            scenario=config["scenario"],
            version=config["version"],
            published_at=config["published_at"],
            assumptions=config["assumptions"],
            sources=estimate.sources,
        ),
        estimate=estimate,
    )


@router.post(
    "",
    status_code=201,
    response_model=SavedEstimateCreated,
    dependencies=[Depends(protect_user(SAVED_ESTIMATE_WRITE))],
)
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
