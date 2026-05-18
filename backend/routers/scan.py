"""
POST /api/scan

Accepts a folder path and returns a list of discovered media files with metadata.
Delegates heavy lifting to services.scanner.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models.media import MediaFile
from services.scanner import scan_folder
from services.ai_curator import start_ai_scan, get_progress, resume_ai_scan, check_incomplete_scan

router = APIRouter()


class ScanRequest(BaseModel):
    folder_path: str
    recursive: bool = True
    include_videos: bool = True


class ScanResponse(BaseModel):
    folder_path: str
    total_files: int
    media: list[MediaFile]


@router.post("/scan", response_model=ScanResponse)
def scan(request: ScanRequest) -> ScanResponse:
    """Traverse *folder_path* and return metadata for every media file found."""
    try:
        media = scan_folder(
            request.folder_path,
            recursive=request.recursive,
            include_videos=request.include_videos,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    return ScanResponse(
        folder_path=request.folder_path,
        total_files=len(media),
        media=media,
    )


# ── AI scan ────────────────────────────────────────────────────────────────────

class AIScanRequest(BaseModel):
    folder_path: str
    provider: str = "ollama"


@router.post("/scan/ai")
def scan_ai(request: AIScanRequest) -> dict:
    """
    Start a background AI scan. Returns immediately; poll /scan/ai/progress.
    Returns HTTP 503 if the AI provider (e.g. Ollama model) is not available.
    """
    try:
        start_ai_scan(request.folder_path, request.provider)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"status": "started"}


@router.get("/scan/ai/progress")
def ai_progress() -> dict:
    """Return current AI scan progress and results (populated when status == 'done')."""
    return get_progress()


@router.get("/scan/ai/resume")
def ai_resume() -> dict:
    """
    Resume from scan_progress.json if an incomplete scan exists.
    Returns {status: 'resumed'|'no_incomplete_scan'|'already_running', completed, total}.
    Poll /scan/ai/progress after a 'resumed' response.
    """
    return resume_ai_scan()


@router.get("/scan/ai/has-incomplete")
def ai_has_incomplete() -> dict:
    """
    Check whether scan_progress.json holds an unfinished scan.
    Returns {has_incomplete: bool, completed, total, folder_path} — never starts anything.
    """
    return check_incomplete_scan()
