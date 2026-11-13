from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from environment variables / backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Quill API"
    version: str = "0.1.0"
    environment: str = "development"

    database_url: str = "sqlite:///./quill.db"

    jwt_secret: str = "dev-insecure-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    # Auth cookie. The JWT is stored in an httpOnly cookie so JavaScript (and XSS) cannot read it.
    # Cross-origin production deployments need COOKIE_SAMESITE=none and COOKIE_SECURE=true.
    cookie_name: str = "quill_session"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    # Development convenience: create demo users/documents on startup (never in production).
    seed_demo_data: bool = False

    # Production single-origin deploy: directory with the built frontend (frontend/dist).
    # When set, FastAPI serves the SPA itself, so the API and UI share one origin.
    frontend_dist: str = ""

    def check_production_safety(self) -> None:
        """Fail fast instead of running production with development secrets."""
        if self.environment == "production":
            if self.jwt_secret in ("", "dev-insecure-change-me") or len(self.jwt_secret) < 32:
                raise RuntimeError("JWT_SECRET must be set to a strong value (32+ chars) in production")
            if not self.cookie_secure:
                raise RuntimeError("COOKIE_SECURE must be true in production (HTTPS)")

    # Comma-separated list of allowed browser origins (only needed when the
    # frontend is served from a different origin, e.g. in production).
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
