"""Platform-only creation, editing, and publication of estimator versions."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.api.dependencies import require_local_user
from app.api.schemas.estimator_config import (
    EstimatorConfigDetail,
    EstimatorConfigDraft,
    EstimatorConfigSummary,
)
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


def stored_sources(body: EstimatorConfigDraft) -> dict:
    """The export snapshot is stored only for scenarios that use it."""
    exclude = {"export"} if body.source_metadata.export is None else None
    return body.source_metadata.model_dump(mode="json", by_alias=True, exclude=exclude)


def locked_draft(session: Session, version_id: UUID) -> EstimatorConfigVersion:
    version = session.scalars(
        select(EstimatorConfigVersion)
        .where(EstimatorConfigVersion.id == version_id)
        .with_for_update()
    ).one_or_none()
    if version is None:
        raise HTTPException(404)
    if version.status != "draft" or version.is_archived:
        raise HTTPException(409)
    return version


@router.get("", response_model=list[EstimatorConfigSummary])
def list_versions(
    admin: Annotated[AppUser, Depends(require_config_admin)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> list[EstimatorConfigSummary]:
    """Every stored version, newest first, so administrators can see what customers get."""
    response.headers["Cache-Control"] = "no-store"
    rows = session.scalars(
        select(EstimatorConfigVersion).order_by(
            EstimatorConfigVersion.version.desc(), EstimatorConfigVersion.id
        )
    ).all()
    return [EstimatorConfigSummary.model_validate(row) for row in rows]


@router.get("/{version_id}", response_model=EstimatorConfigDetail)
def read_version(
    version_id: UUID,
    admin: Annotated[AppUser, Depends(require_config_admin)],
    session: Annotated[Session, Depends(get_session)],
    response: Response,
) -> EstimatorConfigDetail:
    response.headers["Cache-Control"] = "no-store"
    version = session.get(EstimatorConfigVersion, version_id)
    if version is None:
        raise HTTPException(404)
    return EstimatorConfigDetail.model_validate(version)


@router.post("/drafts", status_code=201)
def create_draft(
    body: EstimatorConfigDraft,
    admin: Annotated[AppUser, Depends(require_config_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str | int]:
    scenario = body.scenario
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
        source_metadata=stored_sources(body),
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
    if body.scenario != version.scenario:
        raise HTTPException(422, "A draft keeps the scenario it was created for.")
    version.assumptions = body.assumptions
    version.source_metadata = stored_sources(body)
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


@router.post("/{version_id}/archive")
def archive_config(
    version_id: UUID,
    admin: Annotated[AppUser, Depends(require_config_admin)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, str | int | bool]:
    version = session.scalars(
        select(EstimatorConfigVersion)
        .where(EstimatorConfigVersion.id == version_id)
        .with_for_update()
    ).one_or_none()
    if version is None:
        raise HTTPException(404)
    if version.is_archived:
        raise HTTPException(409, "Configuration version is already archived.")
    if version.status == "published":
        replacement = session.scalar(
            select(EstimatorConfigVersion.id)
            .where(
                EstimatorConfigVersion.scenario == version.scenario,
                EstimatorConfigVersion.version > version.version,
                EstimatorConfigVersion.status == "published",
                EstimatorConfigVersion.is_archived.is_(False),
            )
            .limit(1)
        )
        if replacement is None:
            raise HTTPException(409, "Publish a newer version before archiving this one.")
    version.is_archived = True
    session.commit()
    return {
        "id": str(version.id),
        "version": version.version,
        "status": version.status,
        "is_archived": version.is_archived,
    }
