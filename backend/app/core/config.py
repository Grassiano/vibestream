from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Gemini
    google_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"

    # Supabase
    supabase_url: str = ""
    supabase_service_key: str = ""

    # LemonSqueezy
    lemonsqueezy_api_key: str = ""
    lemonsqueezy_store_id: str = ""

    # Rate limits
    free_sessions_per_day: int = 3
    free_calls_per_session: int = 50
    pro_calls_per_session: int = 500

    # CORS
    cors_origins: list[str] = ["*"]

    model_config = {"env_file": ".env"}


settings = Settings()
