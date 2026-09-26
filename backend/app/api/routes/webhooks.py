"""Clerk lifecycle ingress authenticated by Svix signatures, never bearer claims."""

import json
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, StrictBool, ValidationError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from svix.webhooks import Webhook, WebhookVerificationError

from app.core.account_lifecycle import ProviderAccountState
from app.db.session import get_session
from app.services.lifecycle import synchronize_account

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


class UserData(BaseModel):
    id: str = Field(min_length=1, max_length=255, pattern=r"^user_\S+$")
    banned: StrictBool | None = None
    locked: StrictBool | None = None


class LifecyclePayload(BaseModel):
    type: Literal["user.created", "user.updated", "user.deleted"]
    object: Literal["event"]
    instance_id: str
    timestamp: int = Field(strict=True, gt=0, le=9223372036854775807)
    data: UserData


@router.post("/clerk", status_code=204)
async def clerk_webhook(request: Request, session: Annotated[Session, Depends(get_session)]):
    settings = request.app.state.settings
    if not settings.clerk_webhook_signing_secret or not settings.clerk_instance_id:
        raise HTTPException(503)
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > 1_048_576:
            raise HTTPException(413)
    event_id = request.headers.get("svix-id", "")
    if not event_id or len(event_id) > 255:
        raise HTTPException(400)
    try:
        Webhook(settings.clerk_webhook_signing_secret.get_secret_value()).verify(
            bytes(body), dict(request.headers)
        )
    except WebhookVerificationError:
        raise HTTPException(400) from None
    try:
        payload = json.loads(body)
        if (
            not isinstance(payload, dict)
            or payload.get("instance_id") != settings.clerk_instance_id
        ):
            raise ValueError()
        if payload.get("type") not in {"user.created", "user.updated", "user.deleted"}:
            return Response(status_code=204)
        event = LifecyclePayload.model_validate(payload)
        if event.type == "user.deleted":
            state = ProviderAccountState.DELETED
        else:
            if event.data.banned is None or event.data.locked is None:
                raise ValueError()
            state = (
                ProviderAccountState.SUSPENDED
                if event.data.banned or event.data.locked
                else ProviderAccountState.ACTIVE
            )
    except ValueError, ValidationError:
        raise HTTPException(400) from None

    def persist() -> None:
        synchronize_account(session, event_id, event.data.id, event.timestamp, state)
        session.commit()

    await run_in_threadpool(persist)
    return Response(status_code=204)
