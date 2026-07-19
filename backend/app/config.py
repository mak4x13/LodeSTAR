from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "LodeSTAR"
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    tavily_api_key: Optional[str] = Field(default=None, alias="TAVILY_API_KEY")
    github_token: Optional[str] = Field(default=None, alias="GITHUB_TOKEN")
    elevenlabs_api_key: Optional[str] = Field(default=None, alias="ELEVENLABS_API_KEY")
    elevenlabs_agent_id: Optional[str] = Field(default=None, alias="ELEVENLABS_AGENT_ID")
    supabase_url: Optional[str] = Field(default=None, alias="SUPABASE_URL")
    supabase_service_role_key: Optional[str] = Field(default=None, alias="SUPABASE_SERVICE_ROLE_KEY")
    frontend_origin: str = Field(default="http://localhost:5173", alias="FRONTEND_ORIGIN")
    openai_model: str = Field(default="gpt-4.1", alias="OPENAI_MODEL")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    def missing_runtime_keys(self) -> list[str]:
        required = {
            "OPENAI_API_KEY": self.openai_api_key,
            "TAVILY_API_KEY": self.tavily_api_key,
            "SUPABASE_URL": self.supabase_url,
            "SUPABASE_SERVICE_ROLE_KEY": self.supabase_service_role_key,
        }
        return [key for key, value in required.items() if not value]


@lru_cache
def get_settings() -> Settings:
    return Settings()
