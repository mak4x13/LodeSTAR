from __future__ import annotations

from typing import Any, Optional

from supabase import Client, create_client
from postgrest.exceptions import APIError

from app.config import Settings, get_settings
from app.errors import IntegrationNotConfigured


class SupabaseRepository:
    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        if not self.settings.supabase_url:
            raise IntegrationNotConfigured("SUPABASE_URL", "persisting founders, evidence, scores, and trace events")
        if not self.settings.supabase_service_role_key:
            raise IntegrationNotConfigured(
                "SUPABASE_SERVICE_ROLE_KEY",
                "server-side writes to Supabase tables",
            )
        self.client: Client = create_client(
            self.settings.supabase_url,
            self.settings.supabase_service_role_key,
        )

    async def upsert_founder(
        self,
        founder: dict[str, Any],
        source: str,
        founder_score: float,
        founder_score_trend: str,
    ) -> dict[str, Any]:
        identity_key = founder["identity_key"]
        payload = {
            "identity_key": identity_key,
            "name": founder.get("name"),
            "source": source,
            "profile": founder,
            "founder_score": founder_score,
            "founder_score_trend": founder_score_trend,
        }
        result = (
            self.client.table("founders")
            .upsert(payload, on_conflict="identity_key")
            .execute()
        )
        if not result.data:
            raise RuntimeError("Supabase did not return a founder after upsert.")
        return result.data[0]

    async def insert_evidence(self, founder_id: str, evidence: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not evidence:
            return []
        rows = [{"founder_id": founder_id, **item} for item in evidence]
        result = self.client.table("evidence").insert(rows).execute()
        return result.data or []

    async def insert_scores(self, founder_id: str, scores: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not scores:
            return []
        rows = [{"founder_id": founder_id, **item} for item in scores]
        result = self.client.table("scores").insert(rows).execute()
        return result.data or []

    async def insert_contradictions(self, founder_id: str, contradictions: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not contradictions:
            return []
        rows = [{"founder_id": founder_id, **item} for item in contradictions]
        try:
            result = self.client.table("contradictions").insert(rows).execute()
            return result.data or []
        except APIError as exc:
            if "contradictions" in str(exc) and ("schema cache" in str(exc).lower() or "does not exist" in str(exc).lower()):
                return []
            raise

    async def insert_trace_event(self, event: dict[str, Any]) -> None:
        self.client.table("trace_events").insert(event).execute()

    async def get_founder(self, founder_id: str) -> Optional[dict[str, Any]]:
        result = self.client.table("founders").select("*").eq("id", founder_id).limit(1).execute()
        return result.data[0] if result.data else None

    async def list_founders(self, limit: int = 25) -> list[dict[str, Any]]:
        result = (
            self.client.table("founders")
            .select("*")
            .not_.is_("founder_score", "null")
            .order("updated_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []

    async def get_evidence(self, founder_id: str) -> list[dict[str, Any]]:
        result = self.client.table("evidence").select("*").eq("founder_id", founder_id).execute()
        return result.data or []

    async def get_scores(self, founder_id: str) -> list[dict[str, Any]]:
        result = self.client.table("scores").select("*").eq("founder_id", founder_id).execute()
        return result.data or []

    async def get_contradictions(self, founder_id: str) -> list[dict[str, Any]]:
        try:
            result = self.client.table("contradictions").select("*").eq("founder_id", founder_id).order("created_at", desc=True).execute()
            return result.data or []
        except APIError as exc:
            if "contradictions" in str(exc) and ("schema cache" in str(exc).lower() or "does not exist" in str(exc).lower()):
                return []
            raise
