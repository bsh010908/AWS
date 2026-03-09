from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # ===== Stripe =====
    STRIPE_SECRET_KEY: str
    STRIPE_WEBHOOK_SECRET: str

    # ===== Database =====
    DATABASE_URL: Optional[str] = None
    DB_HOST: Optional[str] = None
    DB_PORT: Optional[int] = None
    DB_USER: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_NAME: Optional[str] = None

    class Config:
        env_file = ".env"


settings = Settings()
