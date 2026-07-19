from __future__ import annotations

from typing import Optional
from uuid import UUID

from app.integrations.openai_client import OpenAIReasoner
from app.schemas.founder import FounderAssessment, ThesisConfig
from app.trace import TraceWriter


class DiligenceAgent:
    def __init__(self, reasoner: OpenAIReasoner, trace: TraceWriter):
        self.reasoner = reasoner
        self.trace = trace

    async def verify(self, run_id: UUID, assessment: FounderAssessment, thesis: Optional[ThesisConfig]) -> FounderAssessment:
        await self.trace.write(run_id, "diligence", "trust_review", f"Reviewing evidence and gaps for {assessment.founder.identity_key}")
        reviewed = await self.reasoner.structured(
            system=(
                "Review the assessment for unsupported claims, contradictions, and missing disclosures. "
                "Preserve evidence-backed claims, downgrade weak trust scores, and add explicit gaps. "
                "Record every pair of mutually inconsistent claims in contradictions with an explanation and unresolved status. "
                "Do not add new facts unless supported by evidence already present in the input."
            ),
            user=str({"assessment": assessment.model_dump(), "thesis": thesis.model_dump() if thesis else None}),
            schema=FounderAssessment,
        )
        await self.trace.write(run_id, "diligence", "trust_scores_ready", f"Reviewed {len(reviewed.evidence)} evidence items", confidence=0.8)
        return reviewed
