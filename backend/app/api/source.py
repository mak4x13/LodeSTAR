from io import BytesIO
from uuid import uuid4

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pypdf import PdfReader

from app.agents.graph import Pipeline
from app.errors import IntegrationNotConfigured, configuration_error
from app.schemas.founder import Source, ThesisConfig
from app.schemas.requests import InboundApplyRequest, OutboundSourceRequest, SearchMandateRequest, SearchPlan

router = APIRouter(prefix="/api/source", tags=["source"])
MAX_DECK_BYTES = 10 * 1024 * 1024


@router.post("/outbound")
async def outbound_source(request: OutboundSourceRequest):
    try:
        pipeline = Pipeline()
        return await pipeline.run_outbound(
            thesis=request.thesis,
            github_query=request.github_query,
            tavily_query=request.tavily_query,
            limit=request.limit,
        )
    except IntegrationNotConfigured as exc:
        raise configuration_error(exc) from exc


@router.post("/inbound")
async def inbound_apply(request: InboundApplyRequest):
    try:
        pipeline = Pipeline()
        run_id = uuid4()
        profile = await pipeline.sourcing.inbound_from_text(
            run_id=run_id,
            text=request.application_text,
            company_name=request.company_name,
            founder_name=request.founder_name,
            email=request.email,
            github_handle=request.github_handle,
            website=request.website,
        )
        return await pipeline.run_inbound(profile, request.thesis, Source.inbound, run_id)
    except IntegrationNotConfigured as exc:
        raise configuration_error(exc) from exc


@router.post("/mandate")
async def mandate_source(request: SearchMandateRequest):
    try:
        pipeline = Pipeline()
        plan = await pipeline.reasoner.structured(
            system=(
                "Translate the investor's natural-language sourcing mandate and structured thesis into two precise live searches. "
                "github_query must be valid GitHub repository search syntax using relevant topic/language/stars/pushed qualifiers. "
                "web_query must target specific founders through product launches, hackathons, papers, patents, accelerator cohorts, "
                "or public company signals. Preserve material geography, stage, sector, traction, and funding constraints."
            ),
            user=str({"mandate": request.mandate, "thesis": request.thesis.model_dump()}),
            schema=SearchPlan,
        )
        return await pipeline.run_outbound(request.thesis, plan.github_query, plan.web_query, request.limit)
    except IntegrationNotConfigured as exc:
        raise configuration_error(exc) from exc


@router.post("/inbound/deck")
async def inbound_deck(
    company_name: str = Form(min_length=1),
    deck: UploadFile = File(...),
    founder_name: str | None = Form(default=None),
    email: str | None = Form(default=None),
    github_handle: str | None = Form(default=None),
    website: str | None = Form(default=None),
    application_text: str | None = Form(default=None),
    thesis: str | None = Form(default=None),
):
    try:
        if deck.content_type != "application/pdf" and not (deck.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=415, detail="Pitch deck must be a PDF file.")
        content = await deck.read(MAX_DECK_BYTES + 1)
        if len(content) > MAX_DECK_BYTES:
            raise HTTPException(status_code=413, detail="Pitch deck must be 10 MB or smaller.")
        try:
            pages = [page.extract_text() or "" for page in PdfReader(BytesIO(content)).pages]
        except Exception as exc:
            raise HTTPException(status_code=422, detail="The PDF could not be read. Export the deck as a text-based PDF and retry.") from exc
        deck_text = "\n\n".join(text.strip() for text in pages if text.strip())
        if len(deck_text) < 50:
            raise HTTPException(status_code=422, detail="The deck contains too little extractable text. Use a text-based PDF rather than scanned images.")
        active_thesis = ThesisConfig.model_validate_json(thesis) if thesis else None
        run_id = uuid4()
        pipeline = Pipeline()
        profile = await pipeline.sourcing.inbound_from_text(
            run_id=run_id,
            text=f"PITCH DECK:\n{deck_text}\n\nFOUNDER CONTEXT:\n{application_text or 'Not provided'}",
            company_name=company_name,
            founder_name=founder_name,
            email=email,
            github_handle=github_handle,
            website=website,
        )
        return await pipeline.run_inbound(profile, active_thesis, Source.inbound, run_id)
    except IntegrationNotConfigured as exc:
        raise configuration_error(exc) from exc
