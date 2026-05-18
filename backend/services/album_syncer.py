"""
Syncs new photos from source_folder into an already-organised folder.

Two-step process:
  1. First call (confirmed=False) → scans and returns a preview (no files copied).
  2. Second call (confirmed=True)  → copies only the previewed new photos.

Matching is done by filename — a file already present anywhere inside
organized_folder (any subfolder) is considered "already organised".
"""

from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from models.media import AlbumSuggestion, SyncResult

_ALLOWED_EXTS = {
    ".jpg", ".jpeg", ".heic", ".heif", ".png",
    ".mp4", ".mov", ".avi", ".mkv", ".wmv", ".webm", ".m4v",
}

# Pending preview stored between the two API calls
_pending: Optional[dict] = None


# ── Helpers ────────────────────────────────────────────────────────────────────

def _organised_filenames(folder: str) -> set[str]:
    p = Path(folder)
    if not p.exists():
        return set()
    return {f.name for f in p.rglob("*") if f.is_file()}


def _source_files(folder: str) -> list[str]:
    return [
        str(f)
        for f in Path(folder).rglob("*")
        if f.is_file() and f.suffix.lower() in _ALLOWED_EXTS
    ]


def _build_preview(new_files: list[str]) -> list[AlbumSuggestion]:
    from services.album_namer import group_photos_by_location, name_album
    from services.geocoder import reverse_geocode

    groups, no_gps = group_photos_by_location(new_files)

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
        albums.append(AlbumSuggestion(
            album_name=name_album(place, date_range, year),
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


# ── Public API ─────────────────────────────────────────────────────────────────

def sync_new_photos(
    source_folder: str,
    organized_folder: str,
    confirmed: bool = False,
) -> SyncResult:
    global _pending

    if confirmed and _pending is not None:
        return _execute_copy(_pending)

    existing = _organised_filenames(organized_folder)
    all_source = _source_files(source_folder)
    new_files = [p for p in all_source if Path(p).name not in existing]

    if not new_files:
        _pending = None
        return SyncResult(
            new_photos_found=0,
            albums_updated=0,
            new_albums_created=0,
            preview=[],
            confirmed=False,
        )

    preview = _build_preview(new_files)
    _pending = {"albums": preview, "organized_folder": organized_folder}

    real_albums = [a for a in preview if a.album_name != "Unsorted"]
    return SyncResult(
        new_photos_found=len(new_files),
        albums_updated=0,
        new_albums_created=len(real_albums),
        preview=preview,
        confirmed=False,
    )


def _execute_copy(pending: dict) -> SyncResult:
    global _pending
    albums: list[AlbumSuggestion] = pending["albums"]
    base = Path(pending["organized_folder"]).expanduser().resolve()
    copied = 0

    for album in albums:
        dst_dir = base / album.album_name
        for src_path in album.photo_paths:
            src = Path(src_path)
            dst = dst_dir / src.name
            if not dst.exists():
                dst_dir.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)
                copied += 1

    _pending = None
    real_albums = [a for a in albums if a.album_name != "Unsorted"]
    return SyncResult(
        new_photos_found=copied,
        albums_updated=0,
        new_albums_created=len(real_albums),
        preview=albums,
        confirmed=True,
    )
