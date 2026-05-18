"""
GET /api/file?path=<absolute-path>

Serves a local media file so the browser can display thumbnails.
Only files with known media extensions are allowed.
"""

import mimetypes
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

router = APIRouter()

_ALLOWED = {
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif",
    ".webp", ".heic", ".heif",
    ".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v",
}


@router.get("/file")
def serve_file(path: str = Query(..., description="Absolute path to a local media file")) -> FileResponse:
    """Return a local media file for inline display in the browser."""
    p = Path(path).resolve()
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    if p.suffix.lower() not in _ALLOWED:
        raise HTTPException(status_code=403, detail="File type not permitted")
    mime, _ = mimetypes.guess_type(p.name)
    return FileResponse(str(p), media_type=mime or "application/octet-stream")
