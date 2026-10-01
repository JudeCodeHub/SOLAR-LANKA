"""Arcjet request-abuse controls applied as FastAPI dependencies."""

import logging
from collections.abc import Awaitable, Callable, Iterable, Mapping
from dataclasses import dataclass
from typing import Annotated, Any, Literal

from arcjet import Arcjet, Mode, arcjet, detect_bot, sliding_window
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.routing import APIRoute

from app.core.auth import VerifiedIdentity, require_identity
from app.core.config import Settings

logger = logging.getLogger(__name__)

USER_CHARACTERISTIC = "userId"


@dataclass(frozen=True, slots=True)
class ProtectionPolicy:
    """One protected operation. Limits are per client IP or per verified Clerk subject."""

    name: str
    max_requests: int
    window_seconds: int
    keyed_by: Literal["ip", "user"]
    block_bots: bool = False
    # Fail open: an Arcjet outage must not take the demo down.
    fail_open: bool = True


ESTIMATE_PREVIEW = ProtectionPolicy("estimate_preview", 30, 60, "ip", block_bots=True)
SAVED_ESTIMATE_WRITE = ProtectionPolicy("saved_estimate_write", 20, 60, "user")
QUOTATION_REQUEST_WRITE = ProtectionPolicy("quotation_request_write", 10, 60, "user")
UPLOAD_REQUEST = ProtectionPolicy("upload_request", 20, 60, "user")
POLICIES = (ESTIMATE_PREVIEW, SAVED_ESTIMATE_WRITE, QUOTATION_REQUEST_WRITE, UPLOAD_REQUEST)


def create_protection_clients(settings: Settings) -> dict[str, Arcjet] | None:
    """Build one client per policy, or None when protection is explicitly disabled."""
    if settings.arcjet_key is None:
        if settings.environment == "production":
            raise RuntimeError("An Arcjet key is required in production")
        logger.warning("Arcjet request protection is disabled: SOLAR_ARCJET_KEY is not set")
        return None
    base = arcjet(
        key=settings.arcjet_key.get_secret_value(),
        rules=[],
        timeout_ms=settings.arcjet_timeout_ms,
        proxies=settings.arcjet_trusted_proxies,
        environment="production" if settings.environment == "production" else "development",
    )
    clients = {}
    for policy in POLICIES:
        characteristics = [USER_CHARACTERISTIC] if policy.keyed_by == "user" else []
        rules: list[Any] = [
            sliding_window(
                mode=Mode.LIVE,
                max=policy.max_requests,
                interval=policy.window_seconds,
                characteristics=characteristics,
            )
        ]
        if policy.block_bots:
            rules.append(detect_bot(mode=Mode.LIVE, allow=[]))
        clients[policy.name] = base.with_rule(rules)
    # Clones share the base transport, so closing the base client closes them all.
    clients["_base"] = base
    return clients


async def close_protection_clients(clients: Mapping[str, Arcjet] | None) -> None:
    if clients is not None:
        await clients["_base"].aclose()


async def enforce(request: Request, policy: ProtectionPolicy, subject: str | None) -> None:
    """Raise 429/403 for denied requests; apply the policy's outage behaviour on errors."""
    clients = request.app.state.arcjet_clients
    if clients is None:
        return
    characteristics = {USER_CHARACTERISTIC: subject} if subject is not None else None
    try:
        decision = await clients[policy.name].protect(request, characteristics=characteristics)
        failed = decision.is_error()
    except Exception:
        # Log the event only: never the request, headers or exception text.
        decision, failed = None, True
    if failed:
        logger.warning("Arcjet protection error on %s", policy.name)
        if not policy.fail_open:
            raise HTTPException(503)
        return
    if decision.is_denied():
        if decision.reason_v2.type == "RATE_LIMIT":
            raise HTTPException(429, headers={"Retry-After": str(policy.window_seconds)})
        raise HTTPException(403)


def protect_ip(policy: ProtectionPolicy) -> Callable[[Request], Awaitable[None]]:
    """For public routes: limits are keyed by the client IP Arcjet detects."""

    async def dependency(request: Request) -> None:
        await enforce(request, policy, None)

    dependency.protection_policy = policy  # type: ignore[attr-defined]
    return dependency


def protect_user(policy: ProtectionPolicy) -> Callable[..., Awaitable[None]]:
    """For authenticated routes: verified identity first, then a per-subject limit."""

    async def dependency(
        request: Request,
        identity: Annotated[VerifiedIdentity, Depends(require_identity)],
    ) -> None:
        await enforce(request, policy, identity.subject)

    dependency.protection_policy = policy  # type: ignore[attr-defined]
    return dependency


def protected_operations(routers: Iterable[APIRouter]) -> frozenset[tuple[str, str]]:
    """(METHOD, path) pairs whose route carries a request-protection dependency."""
    return frozenset(
        (method, route.path)
        for router in routers
        for route in router.routes
        if isinstance(route, APIRoute)
        and any(hasattr(dep.call, "protection_policy") for dep in route.dependant.dependencies)
        for method in route.methods - {"HEAD", "OPTIONS"}
    )
