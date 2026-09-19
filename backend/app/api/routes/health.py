"""Process liveness endpoint; external service readiness is not checked here."""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Confirm that the API process can handle a request."""
    return HealthResponse()
