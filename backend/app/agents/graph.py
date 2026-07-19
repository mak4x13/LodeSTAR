from __future__ import annotations

from typing import Optional
from uuid import uuid4

from app.agents.diligence_agent import DiligenceAgent
from app.agents.memo_agent import MemoAgent
from app.agents.screening_agent import ScreeningAgent
from app.agents.sourcing_agent import SourcingAgent
from app.integrations.github_client import GitHubClient
from app.integrations.openai_client import OpenAIReasoner
from app.integrations.supabase_client import SupabaseRepository
from app.integrations.tavily_client import TavilyClient
from app.schemas.founder import FounderAssessment, FounderProfile, Source, ThesisConfig
from app.trace import TraceWriter


class Pipeline:
    def __init__(self):
        self.repo = SupabaseRepository()
        self.trace = TraceWriter(self.repo)
        self.reasoner = OpenAIReasoner()
        self.sourcing = SourcingAgent(GitHubClient(), TavilyClient(), self.reasoner, self.trace)
        self.screening = ScreeningAgent(self.reasoner, self.trace)
        self.diligence = DiligenceAgent(self.reasoner, self.trace)
        self.memo = MemoAgent(self.reasoner, self.trace)

    async def persist_assessment(self, assessment: FounderAssessment, source: Source) -> dict:
        founder_row = await self.repo.upsert_founder(
            assessment.founder.model_dump(),
            source.value,
            assessment.founder_score,
            assessment.founder_score_trend.value,
        )
        founder_id = founder_row["id"]
        await self.repo.insert_evidence(founder_id, [item.model_dump(mode="json") for item in assessment.evidence])
        await self.repo.insert_scores(founder_id, [item.model_dump(mode="json") for item in assessment.scores])
        await self.repo.insert_contradictions(founder_id, [item.model_dump(mode="json") for item in assessment.contradictions])
        return founder_row

    async def run_outbound(self, thesis: ThesisConfig, github_query: str, tavily_query: Optional[str], limit: int) -> dict:
        run_id = uuid4()
        await self.trace.write(run_id, "graph", "run_started", "Starting outbound sourcing pipeline")
        candidates = await self.sourcing.outbound(run_id, thesis, github_query, tavily_query, limit)
        persisted = []
        for candidate, source in candidates:
            assessment = await self.screening.screen(run_id, candidate, thesis)
            reviewed = await self.diligence.verify(run_id, assessment, thesis)
            persisted.append(await self.persist_assessment(reviewed, source))
        await self.trace.write(run_id, "graph", "run_completed", f"Completed outbound run with {len(persisted)} candidates")
        return {"run_id": str(run_id), "founders": persisted}

    async def run_inbound(self, profile: FounderProfile, thesis: Optional[ThesisConfig], source: Source, run_id=None) -> dict:
        run_id = run_id or uuid4()
        active_thesis = thesis or ThesisConfig()
        await self.trace.write(run_id, "graph", "run_started", f"Starting {source.value} screening pipeline")
        assessment = await self.screening.screen(run_id, profile, active_thesis)
        reviewed = await self.diligence.verify(run_id, assessment, active_thesis)
        founder = await self.persist_assessment(reviewed, source)
        await self.trace.write(run_id, "graph", "run_completed", f"Completed pipeline for {profile.identity_key}")
        return {"run_id": str(run_id), "founder": founder}
