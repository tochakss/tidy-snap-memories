"""
POST /api/scan          — folder metadata scan
POST /api/scan/ai       — synchronous quality scan; provider selects scoring backend
                          provider="cv" (default): pure OpenCV, no network
                          provider="deepseek": CV metrics sent as text to DeepSeek API
GET  /api/scan/ai/results   — return results from last scan
GET  /api/scan/ai/progress  — current scan progress counters
GET  /api/scan/ai/has-incomplete — always false (sync scan never leaves partial state)
"""

import json
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models.media import MediaFile
from services.scanner import scan_folder
from services.cv_scorer import score_file, compute_memory_score
from services.ai_provider import score_memory_deepseek

router = APIRouter()

RESULTS_FILE = Path(__file__).parent.parent / "scan_results.json"
PROGRESS_FILE = Path(__file__).parent.parent / "scan_progress.json"

IMAGE_EXTS = {
    ".jpg", ".jpeg", ".png", ".heic", ".heif",
    ".webp", ".gif", ".bmp", ".tiff", ".tif", ".avif",
}


# ── folder scan ────────────────────────────────────────────────────────────────

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


# ── AI scan (CV-only, synchronous) ────────────────────────────────────────────

class AIScanRequest(BaseModel):
    folder_path: str
    provider: str = "cv"  # "cv" | "deepseek"


@router.post("/scan/ai")
def scan_ai(request: AIScanRequest) -> dict:
    """
    Synchronous scan. Always runs OpenCV first; if provider='deepseek' also
    calls the DeepSeek text API with the CV metrics for a richer memory score.
    Blocks until all photos are processed, then returns.
    """
    folder = Path(request.folder_path)
    if not folder.exists():
        raise HTTPException(status_code=404, detail=f"Folder not found: {request.folder_path}")

    use_deepseek = request.provider == "deepseek"
    files = sorted(p for p in folder.rglob("*") if p.suffix.lower() in IMAGE_EXTS and p.is_file())
    print(f"AI scan starting: {len(files)} images in {folder} (provider={request.provider})")

    # Clear previous run
    RESULTS_FILE.unlink(missing_ok=True)
    PROGRESS_FILE.unlink(missing_ok=True)

    results = []
    for i, p in enumerate(files):
        try:
            cv = score_file(str(p))
            composite = cv.overall_score
            sharpness_pct = min(cv.blur_score / 500.0 * 100, 100.0)
            brightness_pct = cv.brightness_score / 255.0 * 100

            if use_deepseek:
                ai = score_memory_deepseek(
                    filename=p.name,
                    sharpness=sharpness_pct,
                    brightness=brightness_pct,
                    composite=composite,
                    faces=cv.faces_detected,
                )
                memory_score = ai["memory_score"]
                ai_reason = ai["reason"]
                keep = ai["keep"]
            else:
                memory_score, ai_reason, keep = compute_memory_score(cv)

            results.append({
                "file_path": str(p),
                "filename": p.name,
                "thumbnail_url": f"http://localhost:8000/api/file?path={quote(str(p))}",
                "sharpness": cv.blur_score,
                "brightness": cv.brightness_score,
                "composite_score": composite,
                "memory_score": memory_score,
                "ai_reason": ai_reason,
                "keep_suggested": keep,
                "faces_detected": cv.faces_detected,
            })
        except Exception as exc:
            print(f"Skipping {p.name}: {exc}")

        # Checkpoint after every photo
        PROGRESS_FILE.write_text(json.dumps({"completed": i + 1, "total": len(files)}))

    RESULTS_FILE.write_text(json.dumps(results, indent=2))
    print(f"AI scan complete: {len(results)} results saved to {RESULTS_FILE}")

    return {"status": "complete", "total": len(results)}


@router.get("/scan/ai/results")
def ai_results() -> list:
    """Return scored results from the last CV scan."""
    try:
        if not RESULTS_FILE.exists():
            print("Loaded 0 results from disk")
            return []
        data = json.loads(RESULTS_FILE.read_text())
        print(f"Loaded {len(data)} results from disk")
        return data
    except Exception as exc:
        print(f"Error reading results: {exc}")
        return []


@router.get("/scan/ai/progress")
def ai_progress() -> dict:
    """Return progress counters from the last (or current) scan."""
    try:
        if PROGRESS_FILE.exists():
            return json.loads(PROGRESS_FILE.read_text())
    except Exception:
        pass
    return {"completed": 0, "total": 0}


@router.get("/scan/ai/has-incomplete")
def ai_has_incomplete() -> dict:
    """Synchronous scans never leave partial state."""
    return {"has_incomplete": False}
