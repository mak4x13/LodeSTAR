from __future__ import annotations

from typing import Optional

import httpx

from app.config import Settings, get_settings
from app.errors import IntegrationNotConfigured


class ElevenLabsClient:
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        if not self.settings.elevenlabs_api_key:
            raise IntegrationNotConfigured("ELEVENLABS_API_KEY", "the live founder voice interview")

    async def setup_status(self) -> dict[str, str]:
        return {
            "status": "ready" if self.settings.elevenlabs_agent_id else "agent_setup_required",
            "conversation": "configured" if self.settings.elevenlabs_agent_id else "ELEVENLABS_AGENT_ID is missing",
        }

    async def signed_conversation_url(self) -> str:
        if not self.settings.elevenlabs_agent_id:
            raise IntegrationNotConfigured("ELEVENLABS_AGENT_ID", "the live founder voice interview")
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                "https://api.elevenlabs.io/v1/convai/conversation/get_signed_url",
                params={"agent_id": self.settings.elevenlabs_agent_id},
                headers={"xi-api-key": self.settings.elevenlabs_api_key},
            )
            response.raise_for_status()
            return response.json()["signed_url"]
