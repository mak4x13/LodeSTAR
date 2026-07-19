from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.founder import ThesisConfig


class OutboundSourceRequest(BaseModel):
    thesis: ThesisConfig
    github_query: str
    tavily_query: Optional[str] = None
    limit: int = Field(default=5, ge=1, le=10)


class SearchMandateRequest(BaseModel):
    thesis: ThesisConfig
    mandate: str = Field(min_length=10, max_length=1000)
    limit: int = Field(default=5, ge=1, le=10)


class SearchPlan(BaseModel):
    github_query: str
    web_query: str


class InboundApplyRequest(BaseModel):
    company_name: str
    founder_name: Optional[str] = None
    email: Optional[str] = None
    github_handle: Optional[str] = None
    website: Optional[str] = None
    application_text: str = Field(min_length=20)
    thesis: Optional[ThesisConfig] = None


class ScreenRequest(BaseModel):
    founder_id: str
    thesis: ThesisConfig


class DiligenceRequest(BaseModel):
    founder_id: str
    thesis: Optional[ThesisConfig] = None


class DecisionRequest(BaseModel):
    founder_id: str
    thesis: Optional[ThesisConfig] = None


class VoiceTranscriptRequest(BaseModel):
    transcript: str = Field(min_length=20)
    thesis: Optional[ThesisConfig] = None
