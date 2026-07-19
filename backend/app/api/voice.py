from uuid import uuid4

from fastapi import APIRouter

from app.agents.graph import Pipeline
from app.errors import IntegrationNotConfigured, configuration_error
from app.integrations.elevenlabs_client import ElevenLabsClient
from app.schemas.founder import Source
from app.schemas.requests import VoiceTranscriptRequest

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.get("/status")
async def voice_status():
    try:
        client = ElevenLabsClient()
        return await client.setup_status()
    except IntegrationNotConfigured as exc:
        raise configuration_error(exc) from exc


@router.post("/session")
async def voice_session():
    try:
        return {"signed_url": await ElevenLabsClient().signed_conversation_url()}
    except IntegrationNotConfigured as exc:
        raise configuration_error(exc) from exc


@router.post("/transcript")
async def voice_transcript(request: VoiceTranscriptRequest):
    try:
        pipeline = Pipeline()
        run_id = uuid4()
        profile = await pipeline.sourcing.inbound_from_text(
            run_id=run_id,
            text=request.transcript,
            company_name="Voice intake submission",
            founder_name=None,
            email=None,
            github_handle=None,
            website=None,
        )
        return await pipeline.run_inbound(profile, request.thesis, Source.voice_intake, run_id)
    except IntegrationNotConfigured as exc:
        raise configuration_error(exc) from exc
