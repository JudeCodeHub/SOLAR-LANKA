"""Platform-only creation, editing, and publication of estimator versions."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.schemas.estimator_config import EstimatorConfigDraft
from app.core.estimator_scenario import GRID_NET_METERING
from app.core.permissions import Action, Scope, required_scopes
from app.db.session import get_session
from app.models.estimator_config import EstimatorConfigVersion
from app.models.user import AppUser

router = APIRouter(prefix="/admin/estimator-configs", tags=["estimator administration"])


def require_config_admin(
    user: Annotated[AppUser, Depends(require_local_user)],
) -> AppUser:
    if Scope.PLATFORM not in required_scopes(Action.CALCULATION_CONFIG_MANAGE, user.role):
        raise HTTPException(403)
    return user


def locked_draft(session: Session, version_id: UUID) -> EstimatorConfigVersion:
    version = session.scalars(
        select(EstimatorConfigVersion)
        .where(EstimatorConfigVersion.id == version_id)
        .with_for_update()
    ).one_or_none()
    if version is None:
        raise HTTPException(404)
    if version.status != "draft":
        raise HTTPException(409)
    return version


@router.post("/drafts", status_code=201)
def create_draft(
    body: EstimatorConfigDraft,
    admin: Annotated[AppUser, Depends(require_config_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str | int]:
    scenario = GRID_NET_METERING.identifier
    session.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:scenario))"),
        {"scenario": scenario},
    )
    latest = session.scalar(
        select(func.max(EstimatorConfigVersion.version)).where(
            EstimatorConfigVersion.scenario == scenario
        )
    )
    version = EstimatorConfigVersion(
        scenario=scenario,
        version=(latest or 0) + 1,
        assumptions=body.assumptions,
        source_metadata=body.source_metadata.model_dump(mode="json", by_alias=True),
    )
    session.add(version)
    session.commit()
    return {"id": str(version.id), "version": version.version, "status": version.status}


@router.put("/drafts/{version_id}")
def edit_draft(
    version_id: UUID,
    body: EstimatorConfigDraft,
    admin: Annotated[AppUser, Depends(require_config_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str | int]:
    version = locked_draft(session, version_id)
    version.assumptions = body.assumptions
    version.source_metadata = body.source_metadata.model_dump(mode="json", by_alias=True)
    session.commit()
    return {"id": str(version.id), "version": version.version, "status": version.status}


@router.post("/drafts/{version_id}/publish")
def publish_draft(
    version_id: UUID,
    admin: Annotated[AppUser, Depends(require_config_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str | int]:
    if Scope.PLATFORM not in required_scopes(Action.CALCULATION_CONFIG_PUBLISH, admin.role):
        raise HTTPException(403)
    version = locked_draft(session, version_id)
    version.status = "published"
    version.published_at = datetime.now(UTC)
    session.commit()
    return {"id": str(version.id), "version": version.version, "status": version.status}
