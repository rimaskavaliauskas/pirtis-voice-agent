"""
Application configuration from environment variables.
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    database_url: str = "postgresql+asyncpg://agent:agentbrain_secure_2024@localhost:5432/agentbrain"

    # Redis (optional)
    redis_url: str = "redis://localhost:6379/0"

    # Claude API
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-3-5-sonnet-20241022"

    # Admin
    admin_api_key: str = "change-this-in-production"

    # CORS
    allowed_origins: str = "http://localhost:3000"

    # Whisper
    whisper_model: str = "medium"
    max_audio_bytes: int = 8 * 1024 * 1024  # 8 MB upload cap to guard STT

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    @property
    def cors_origins(self) -> List[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
