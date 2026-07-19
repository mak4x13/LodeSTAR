from uuid import uuid4
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.agents.graph import Pipeline
from app.errors import IntegrationNotConfigured, configuration_error
from app.schemas.requests import DecisionRequest

router = APIRouter(prefix="/api/decision", tags=["decision"])


@router.post("")
async def decision_memo(request: DecisionRequest):
    try:
        pipeline = Pipeline()
        founder = await pipeline.repo.get_founder(request.founder_id)
        if not founder:
            raise HTTPException(status_code=404, detail="Founder not found")
        evidence = await pipeline.repo.get_evidence(request.founder_id)
        scores = await pipeline.repo.get_scores(request.founder_id)
        run_id = uuid4()
        memo = await pipeline.memo.write_memo(run_id, request.founder_id, founder, evidence, scores, request.thesis)
        first_signal = datetime.fromisoformat(founder["created_at"].replace("Z", "+00:00"))
        elapsed_seconds = max(0, int((datetime.now(timezone.utc) - first_signal).total_seconds()))
        return {"run_id": str(run_id), "memo": memo, "decision_time_seconds": elapsed_seconds, "within_24h": elapsed_seconds <= 86400}
    except IntegrationNotConfigured as exc:
        raise configuration_error(exc) from exc
