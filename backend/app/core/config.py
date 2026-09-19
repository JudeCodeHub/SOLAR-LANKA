"""Validated environment configuration for application startup."""

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Load only the configuration needed by currently implemented features."""

    model_config = SettingsConfigDict(
        env_prefix="SOLAR_",
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="forbid",
        hide_input_in_errors=True,
    )

    environment: Literal["development", "test", "production"]
    app_name: str = Field(default="Solar Lanka API", min_length=1)
