from __future__ import annotations

from typing import Optional
from uuid import UUID

from app.integrations.openai_client import OpenAIReasoner
from app.schemas.founder import InvestmentMemo, ThesisConfig
from app.trace import TraceWriter


class MemoAgent:
    def __init__(self, reasoner: OpenAIReasoner, trace: TraceWriter):
        self.reasoner = reasoner
        self.trace = trace

    async def write_memo(self, run_id: UUID, founder_id: str, founder: dict, evidence: list[dict], scores: list[dict], thesis: Optional[ThesisConfig]) -> InvestmentMemo:
        await self.trace.write(run_id, "decision", "memo_generation", f"Generating evidence-backed memo for founder {founder_id}")
        memo = await self.reasoner.structured(
            system=(
                "Write only the required investment memo sections: Company snapshot, Investment hypotheses, SWOT, "
                "Problem & product, Traction & KPIs. Each bullet must be grounded in provided evidence_refs or listed as a gap. "
                "Do not invent missing metrics, funding, customers, or team history. "
                "Give one explicit recommendation: invest, continue_diligence, or pass. Explain it concisely and list concrete "
                "conditions that must be resolved before deploying capital. A high founder score alone is not sufficient."
            ),
            user=str(
                {
                    "founder_id": founder_id,
                    "founder": founder,
                    "evidence": evidence,
                    "scores": scores,
                    "thesis": thesis.model_dump() if thesis else None,
                }
            ),
            schema=InvestmentMemo,
        )
        await self.trace.write(run_id, "decision", "memo_ready", f"Memo ready for founder {founder_id}", confidence=0.85)
        return memo
