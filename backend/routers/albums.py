"""
POST /api/albums/generate          — cluster folder by GPS and return album suggestions
POST /api/albums/export            — copy albums to an output folder (async)
GET  /api/albums/export/progress   — poll export progress
POST /api/albums/sync              — preview or confirm sync of new photos
POST /api/albums/open-folder       — open a folder in macOS Finder
"""

from __future__ import annotations

import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models.media import AlbumSuggestion, ExportResult, SyncResult
from services.album_exporter import get_export_progress, start_export
from services.album_syncer import sync_new_photos

router = APIRouter()


# ── Request models ─────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    folder_path: str
    provider: str = "ollama"   # provider used for album naming (claude / ollama / grok)
    use_ai_names: bool = False  # set True to call LLM for each album name


class ExportRequest(BaseModel):
    albums: list[AlbumSuggestion]
    output_path: str


class SyncRequest(BaseModel):
    source_folder: str
    organized_folder: str
    confirmed: bool = False


class OpenFolderRequest(BaseModel):
    path: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/albums/generate", response_model=list[AlbumSuggestion])
def generate_albums(request: GenerateRequest) -> list[AlbumSuggestion]:
    """
    Scan *folder_path*, extract GPS, cluster by proximity + date, geocode each
    cluster, and (optionally) name each album with AI.

    This endpoint is synchronous. With many unique locations it may take
    10–60 s due to Nominatim's 1 req/sec rate limit.
    """
    from services.album_namer import group_photos_by_location, name_album
    from services.geocoder import reverse_geocode
    from services.scanner import scan_folder

    try:
        media = scan_folder(request.folder_path, recursive=True)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    all_paths = [mf.path for mf in media]
    groups, no_gps = group_photos_by_location(all_paths)

    albums: list[AlbumSuggestion] = []
    for g in groups:
        photos = g["photos"]
        clat, clon = g["center_lat"], g["center_lon"]
        place = reverse_geocode(clat, clon)

        mtimes = [p["mtime"] for p in photos]
        earliest = datetime.fromtimestamp(min(mtimes))
        latest = datetime.fromtimestamp(max(mtimes))
        year = earliest.year
        date_range = (
            earliest.strftime("%b %d, %Y")
            if earliest.date() == latest.date()
            else f"{earliest.strftime('%b %d')} – {latest.strftime('%b %d, %Y')}"
        )

        if request.use_ai_names:
            album_name = name_album(place, date_range, year, provider=request.provider)
        else:
            album_name = f"{place} {year}"

        albums.append(AlbumSuggestion(
            album_name=album_name,
            photo_count=len(photos),
            date_range=date_range,
            location=place,
            lat=clat,
            lon=clon,
            photo_paths=[p["path"] for p in photos],
        ))

    if no_gps:
        albums.append(AlbumSuggestion(
            album_name="Unsorted",
            photo_count=len(no_gps),
            date_range="",
            location="No GPS data",
            photo_paths=no_gps,
        ))

    return albums


@router.post("/albums/export")
def export_albums(request: ExportRequest) -> dict:
    """Start a background copy of *albums* into *output_path*. Poll /export/progress."""
    if not request.albums:
        raise HTTPException(status_code=400, detail="No albums provided")
    start_export(request.albums, request.output_path)
    return {"status": "started"}


@router.get("/albums/export/progress")
def export_progress() -> dict:
    """Return current export progress. result is populated when status == 'done'."""
    return get_export_progress()


@router.post("/albums/sync", response_model=SyncResult)
def sync_albums(request: SyncRequest) -> SyncResult:
    """
    Two-step sync:
      confirmed=False → scan and return a preview (no files copied).
      confirmed=True  → execute the pending copy from the previous preview call.
    """
    try:
        return sync_new_photos(
            request.source_folder,
            request.organized_folder,
            confirmed=request.confirmed,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/albums/open-folder")
def open_folder(request: OpenFolderRequest) -> dict:
    """Open a folder in macOS Finder. Only works when the backend runs on macOS."""
    p = Path(request.path).expanduser().resolve()
    if not p.is_dir():
        raise HTTPException(status_code=404, detail=f"Not a directory: {p}")
    try:
        subprocess.run(["open", str(p)], check=True, timeout=5)
        return {"opened": str(p)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
