"""Application settings loaded from environment variables / ``.env``."""

from typing import Literal, Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET_KEY = "dev-only-insecure-secret-key-change-me"  # noqa: S105 - dev default only
MIN_SECRET_KEY_LENGTH = 32
PLACEHOLDER_SECRET_PREFIXES = ("replace-with", "dev-only", "change-me")


class Settings(BaseSettings):
    """Runtime configuration. Field names are UPPERCASE to match env var names."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "Kalaai Code"
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    RATE_LIMIT_ENABLED: bool = True

    # Database
    DATABASE_URL: str = "postgresql://kalaai:kalaai@localhost:5432/kalaai_code"

    # Auth
    SECRET_KEY: str = DEFAULT_SECRET_KEY
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"

    # AI provider: "anthropic" (default) or "openai"
    AI_PROVIDER: Literal["anthropic", "openai"] = "anthropic"

    # OpenAI (used only when AI_PROVIDER=openai)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-5.5"

    # Anthropic Claude
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-opus-5-5"
    CLAUDE_MAX_TOKENS: int = 4096

    # GitHub (optional; raises API rate limits when set)
    GITHUB_TOKEN: str = ""

    # Uploads
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_MB: int = 5
    MAX_UPLOAD_FILES: int = 50

    # Pipeline: max concurrent AI review/roast runs (keeps the worker threadpool free)
    MAX_CONCURRENT_PIPELINES: int = 3

    @property
    def is_production(self) -> bool:
        """Return True when running in the production environment."""
        return self.ENVIRONMENT.lower() == "production"

    @model_validator(mode="after")
    def _reject_default_secret_in_production(self) -> Self:
        """Refuse to start in production with a weak, short or placeholder ``SECRET_KEY``."""
        if not self.is_production:
            return self
        key = self.SECRET_KEY
        if (
            key == DEFAULT_SECRET_KEY
            or len(key) < MIN_SECRET_KEY_LENGTH
            or key.lower().startswith(PLACEHOLDER_SECRET_PREFIXES)
        ):
            raise ValueError(
                "SECRET_KEY must be a strong unique value of at least "
                f"{MIN_SECRET_KEY_LENGTH} characters in production"
            )
        return self


def get_settings() -> Settings:
    """Return the cached settings instance (usable as a FastAPI dependency)."""
    return settings


settings = Settings()
