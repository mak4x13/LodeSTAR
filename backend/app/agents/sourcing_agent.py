from __future__ import annotations

from typing import Optional
from uuid import UUID

from app.integrations.github_client import GitHubClient
from app.integrations.openai_client import OpenAIReasoner
from app.integrations.tavily_client import TavilyClient
from app.schemas.founder import CandidateExtraction, FounderProfile, Source, ThesisConfig
from app.trace import TraceWriter


class SourcingAgent:
    def __init__(
        self,
        github: GitHubClient,
        tavily: TavilyClient,
        reasoner: OpenAIReasoner,
        trace: TraceWriter,
    ):
        self.github = github
        self.tavily = tavily
        self.reasoner = reasoner
        self.trace = trace

    async def outbound(self, run_id: UUID, thesis: ThesisConfig, github_query: str, tavily_query: Optional[str], limit: int) -> list[tuple[FounderProfile, Source]]:
        github_limit = limit if not tavily_query else max(1, (limit + 1) // 2)
        await self.trace.write(run_id, "sourcing", "github_search", f"Searching GitHub repositories for: {github_query}")
        repos = await self.github.search_repositories(github_query, github_limit)

        web_results = []
        if tavily_query:
            await self.trace.write(run_id, "sourcing", "tavily_search", f"Searching open web for: {tavily_query}")
            web_results = await self.tavily.search(tavily_query, max(limit, 5))

        profiles: list[tuple[FounderProfile, Source]] = []
        for repo in repos:
            owner = repo.get("owner", {})
            login = owner.get("login")
            user = await self.github.get_user(login) if login else {}
            prompt = {
                "thesis": thesis.model_dump(),
                "github_repository": repo,
                "github_user": user,
                "web_results": web_results,
            }
            parsed = await self.reasoner.structured(
                system=(
                    "Extract a founder candidate from real API evidence only. "
                    "Use identity_key as github:<handle> when a handle exists. "
                    "List unavailable fields in gaps. Do not invent facts."
                ),
                user=str(prompt),
                schema=FounderProfile,
            )
            profiles.append((parsed, Source.outbound_github))
            await self.trace.write(
                run_id,
                "sourcing",
                "candidate_extracted",
                f"Extracted candidate {parsed.identity_key}",
                confidence=0.75,
            )
        remaining = limit - len(profiles)
        if remaining > 0:
            for result in web_results:
                extracted = await self.reasoner.structured(
                    system=(
                        "Determine whether this real web result identifies a specific active founder or founding team behind a company, "
                        "product launch, hackathon project, research commercialization effort, patent, or accelerator company. "
                        "Reject generic articles, investor pages, directories without a specific founder, and ambiguous people. "
                        "When valid, extract only stated facts, preserve the result URL in raw_signals, use email/github when available, "
                        "otherwise use identity_key as website:<domain-or-stable-company-slug>, and list unknowns as gaps."
                    ),
                    user=str({"thesis": thesis.model_dump(), "web_result": result}),
                    schema=CandidateExtraction,
                )
                if not extracted.is_candidate or not extracted.founder:
                    continue
                if any(existing.identity_key == extracted.founder.identity_key for existing, _ in profiles):
                    continue
                profiles.append((extracted.founder, Source.outbound_tavily))
                await self.trace.write(run_id, "sourcing", "web_candidate_extracted", f"Web signal produced candidate {extracted.founder.identity_key}", confidence=0.7)
                if len(profiles) >= limit:
                    break
        return profiles

    async def inbound_from_text(self, run_id: UUID, text: str, company_name: str, founder_name: Optional[str], email: Optional[str], github_handle: Optional[str], website: Optional[str]) -> FounderProfile:
        await self.trace.write(run_id, "sourcing", "inbound_parse", f"Parsing inbound application for {company_name}")
        identity_hint = github_handle or email
        parsed = await self.reasoner.structured(
            system=(
                "Normalize an inbound founder application into the shared founder schema. "
                "Use only facts present in the submitted text and provided fields. "
                "Use identity_key as github:<handle> or email:<email>. If neither exists, fail by placing a gap and use company:<company_name>. "
                "Do not fabricate traction, funding, market, or team details."
            ),
            user=str(
                {
                    "company_name": company_name,
                    "founder_name": founder_name,
                    "email": email,
                    "github_handle": github_handle,
                    "website": website,
                    "identity_hint": identity_hint,
                    "application_text": text,
                }
            ),
            schema=FounderProfile,
        )
        return parsed
