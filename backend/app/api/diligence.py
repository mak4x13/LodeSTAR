from uuid import uuid4

from fastapi import APIRouter, HTTPException

from app.agents.graph import Pipeline
from app.errors import IntegrationNotConfigured, configuration_error
from app.schemas.founder import ContradictionItem, EvidenceItem, FounderAssessment, FounderProfile, ScoreItem, Source
from app.schemas.requests import DiligenceRequest

router = APIRouter(prefix="/api/diligence", tags=["diligence"])


@router.post("")
async def diligence_founder(request: DiligenceRequest):
    try:
        pipeline = Pipeline()
        founder = await pipeline.repo.get_founder(request.founder_id)
        if not founder:
            raise HTTPException(status_code=404, detail="Founder not found")
        scores = await pipeline.repo.get_scores(request.founder_id)
        evidence = await pipeline.repo.get_evidence(request.founder_id)
        contradictions = await pipeline.repo.get_contradictions(request.founder_id)
        latest_scores = {}
        for row in sorted(scores, key=lambda item: item.get("created_at") or ""):
            latest_scores[row["axis"]] = row
        distinct_evidence = {}
        for row in sorted(evidence, key=lambda item: item.get("created_at") or ""):
            distinct_evidence[(row.get("claim"), row.get("source_url"))] = row
        assessment = FounderAssessment(
            founder=FounderProfile(**founder["profile"]),
            evidence=[
                EvidenceItem(**{key: row.get(key) for key in ("claim", "source_url", "source_snippet", "trust_score", "evidence_type")})
                for row in distinct_evidence.values()
            ],
            scores=[
                ScoreItem(**{key: row.get(key) for key in ("axis", "score", "trend", "rationale")})
                for row in latest_scores.values()
            ],
            contradictions=[
                ContradictionItem(**{key: row.get(key) for key in ("claim_a", "claim_b", "explanation", "status")})
                for row in contradictions
            ],
            founder_score=founder.get("founder_score"),
            founder_score_trend=founder.get("founder_score_trend"),
        )
        run_id = uuid4()
        reviewed = await pipeline.diligence.verify(run_id, assessment, request.thesis)
        persisted = await pipeline.persist_assessment(reviewed, Source(founder["source"]))
        return {
            "run_id": str(run_id),
            "founder": persisted,
            "scores": [item.model_dump(mode="json") for item in reviewed.scores],
            "evidence": [item.model_dump(mode="json") for item in reviewed.evidence],
            "contradictions": [item.model_dump(mode="json") for item in reviewed.contradictions],
        }
    except IntegrationNotConfigured as exc:
        raise configuration_error(exc) from exc
