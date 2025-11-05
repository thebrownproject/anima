"""Application configuration using environment variables"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # Supabase Configuration
    SUPABASE_URL: str
    SUPABASE_KEY: str  # Service role key for backend operations

    # OpenRouter API Configuration
    OPENROUTER_API_KEY: str
    OPENROUTER_MODEL: str = "anthropic/claude-4.5-sonnet"  # Default model

    # Mistral API Configuration (for OCR)
    MISTRAL_API_KEY: str

    # Application Configuration
    APP_NAME: str = "StackDocs MVP"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # CORS Configuration
    ALLOWED_ORIGINS: str = "http://localhost:3000"  # Frontend URL (comma-separated for multiple)

    model_config = SettingsConfigDict(  # pyright: ignore[reportUnannotatedClassAttribute]
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()  # pyright: ignore[reportCallIssue]
