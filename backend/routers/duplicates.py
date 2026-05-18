"""
GET  /api/duplicates          — scan folder and return duplicate groups
POST /api/duplicates/delete   — move selected files to system Trash (never hard-delete)
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from send2trash import send2trash  # type: ignore

from models.media import DuplicateGroup
from services.duplicate_detector import find_duplicates

router = APIRouter()

_ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif",
    ".webp", ".heic", ".heif", ".raw", ".cr2", ".nef", ".arw",
    ".mp4", ".mov", ".avi", ".mkv", ".wmv", ".flv", ".webm", ".m4v",
}


# ── GET /duplicates ────────────────────────────────────────────────────────────

class DuplicatesResponse(BaseModel):
    total_groups: int
    wasted_bytes: int
    groups: list[DuplicateGroup]


@router.get("/duplicates", response_model=DuplicatesResponse)
def duplicates(
    folder_path: str = Query(..., description="Folder to scan for duplicates"),
    recursive: bool = Query(True),
    near_match: bool = Query(True, description="Include perceptual-hash near-dupes"),
) -> DuplicatesResponse:
    """Find exact and near-duplicate media files within *folder_path*."""
    try:
        groups = find_duplicates(folder_path, recursive=recursive, near_match=near_match)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    wasted = sum(
        sum(f.size_bytes for f in g.files[1:]) for g in groups
    )

    return DuplicatesResponse(
        total_groups=len(groups),
        wasted_bytes=wasted,
        groups=groups,
    )


# ── POST /duplicates/delete ────────────────────────────────────────────────────

class DeleteRequest(BaseModel):
    file_paths: list[str]


class DeleteResult(BaseModel):
    deleted: int
    freed_bytes: int
    errors: list[str]


@router.post("/duplicates/delete", response_model=DeleteResult)
def delete_duplicates(body: DeleteRequest) -> DeleteResult:
    """
    Move each file in *file_paths* to the system Trash.

    Files are NEVER permanently deleted — send2trash uses the OS recycle bin
    so the user can recover them if needed. Only media file extensions are
    accepted; anything else is rejected to prevent accidental data loss.
    """
    deleted = 0
    freed_bytes = 0
    errors: list[str] = []

    for raw_path in body.file_paths:
        p = Path(raw_path).resolve()

        if p.suffix.lower() not in _ALLOWED_EXTENSIONS:
            errors.append(f"Rejected (not a media file): {p.name}")
            continue

        if not p.exists():
            errors.append(f"Not found: {raw_path}")
            continue

        try:
            size = p.stat().st_size
            send2trash(str(p))  # moves to OS Trash — recoverable
            deleted += 1
            freed_bytes += size
        except Exception as exc:
            errors.append(f"{p.name}: {exc}")

    return DeleteResult(deleted=deleted, freed_bytes=freed_bytes, errors=errors)
