from fastapi import APIRouter, HTTPException, Query

from app.integrations.supabase_client import SupabaseRepository
from app.errors import IntegrationNotConfigured, configuration_error

router = APIRouter(prefix="/api/founders", tags=["founders"])


@router.get("")
async def list_founders(limit: int = Query(default=25, ge=1, le=100)):
    try:
        repo = SupabaseRepository()
        return {"founders": await repo.list_founders(limit)}
    except IntegrationNotConfigured as exc:
        raise configuration_error(exc) from exc


@router.get("/{founder_id}")
async def get_founder(founder_id: str):
    try:
        repo = SupabaseRepository()
        founder = await repo.get_founder(founder_id)
        if not founder:
            raise HTTPException(status_code=404, detail="Founder not found")
        return {
            "founder": founder,
            "evidence": await repo.get_evidence(founder_id),
            "scores": await repo.get_scores(founder_id),
            "contradictions": await repo.get_contradictions(founder_id),
        }
    except IntegrationNotConfigured as exc:
        raise configuration_error(exc) from exc
