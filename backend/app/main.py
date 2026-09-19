"""Application factory used by Uvicorn and API tests."""

from fastapi import FastAPI
from pydantic import ValidationError

from app.api.routes.health import router as health_router
from app.core.config import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """Validate configuration before creating the application."""
    if settings is None:
        try:
            settings = Settings()
        except ValidationError as exc:
            fields = ", ".join(
                ".".join(str(part) for part in error["loc"])
                for error in exc.errors(include_input=False, include_url=False)
            )
            raise RuntimeError(
                f"Invalid configuration: {fields}. "
                "Check SOLAR_ environment variables or backend/.env against .env.example."
            ) from None

    application = FastAPI(title=settings.app_name, version="0.1.0")
    application.include_router(health_router)
    return application
