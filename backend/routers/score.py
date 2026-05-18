"""
POST /api/score

Accepts a list of file paths and returns CV quality scores (blur, brightness, composite).
Delegates computation to services.cv_scorer.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models.media import ScoreResult
from services.cv_scorer import score_files

router = APIRouter()


class ScoreRequest(BaseModel):
    paths: list[str] = []
    folder_path: str | None = None  # score all media in a folder instead


class ScoreResponse(BaseModel):
    results: list[ScoreResult]


@router.post("/score", response_model=ScoreResponse)
def score(request: ScoreRequest) -> ScoreResponse:
    """
    Score each file for sharpness, brightness, and overall quality.
    Provide either *paths* (explicit list) or *folder_path* (score entire folder).
    """
    if not request.paths and not request.folder_path:
        raise HTTPException(
            status_code=422, detail="Provide 'paths' or 'folder_path'."
        )

    try:
        results = score_files(
            paths=request.paths,
            folder_path=request.folder_path,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return ScoreResponse(results=results)
