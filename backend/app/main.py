"""Application factory used by Uvicorn and API tests."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import ValidationError

from app.api.errors import register_error_handlers
from app.api.routes.audit import router as audit_router
from app.api.routes.catalogue import router as catalogue_router
from app.api.routes.catalogue_admin import router as catalogue_admin_router
from app.api.routes.companies import public_router as public_companies_router
from app.api.routes.companies import router as companies_router
from app.api.routes.estimator_config import router as estimator_config_router
from app.api.routes.favourites import router as favourites_router
from app.api.routes.health import router as health_router
from app.api.routes.media_uploads import router as media_uploads_router
from app.api.routes.memberships import router as memberships_router
from app.api.routes.offers import router as offers_router
from app.api.routes.private_media import router as private_media_router
from app.api.routes.readiness import router as readiness_router
from app.api.routes.users import router as users_router
from app.api.routes.webhooks import router as webhooks_router
from app.api.schemas.errors import ERROR_STATUS_CODES, ErrorResponse
from app.core.config import Settings
from app.core.database_config import DatabaseSettings
from app.db.session import create_database_engine, create_session_factory


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

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        engine = None
        application.state.database_engine = None
        application.state.session_factory = None
        try:
            if settings.database_url is not None or settings.test_database_url is not None:
                database_settings = DatabaseSettings(_env_file=None, **settings.model_dump())
                engine = create_database_engine(database_settings)
                application.state.database_engine = engine
                application.state.session_factory = create_session_factory(engine)
            yield
        finally:
            if engine is not None:
                engine.dispose()
            application.state.database_engine = None
            application.state.session_factory = None

    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
        responses={code: {"model": ErrorResponse} for code in ERROR_STATUS_CODES.values()},
    )
    application.state.settings = settings
    register_error_handlers(application)
    application.include_router(health_router)
    application.include_router(readiness_router)
    application.include_router(users_router)
    application.include_router(memberships_router)
    application.include_router(media_uploads_router)
    application.include_router(private_media_router)
    application.include_router(offers_router)
    application.include_router(companies_router)
    application.include_router(catalogue_admin_router)
    application.include_router(estimator_config_router)
    application.include_router(catalogue_router)
    application.include_router(favourites_router)
    application.include_router(audit_router)
    application.include_router(public_companies_router)
    application.include_router(webhooks_router)
    return application
