"""
POST /api/publish

Accepts a file path and optional context; returns AI-generated YouTube
title, description, and tags via the configured AI provider.
Delegates to services.ai_provider.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models.media import PublishResult
from services.ai_provider import generate_publish_metadata

router = APIRouter()


class PublishRequest(BaseModel):
    path: str
    context: str = ""  # optional user-supplied description hint
    provider: str = "ollama"  # "ollama" | "claude" | "grok"


@router.post("/publish", response_model=PublishResult)
def publish(request: PublishRequest) -> PublishResult:
    """Generate YouTube title, description, and tags for the given media file."""
    try:
        result = generate_publish_metadata(
            path=request.path,
            context=request.context,
            provider=request.provider,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return result
