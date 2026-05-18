"""
Copies photos into named album folders.
NEVER moves or deletes originals — uses shutil.copy2 (preserves metadata).
Maintains a global progress state polled by GET /api/albums/export/progress.
"""

from __future__ import annotations

import shutil
import threading
from pathlib import Path
from typing import Any

from models.media import AlbumSuggestion, ExportResult

_lock = threading.Lock()
_progress: dict[str, Any] = {
    "status": "idle",   # idle | running | done | error
    "total": 0,
    "copied": 0,
    "skipped": 0,
    "current_file": "",
    "error": None,
    "result": None,
}


def get_export_progress() -> dict[str, Any]:
    with _lock:
        return dict(_progress)


def _safe_copy(src: Path, dst: Path) -> str:
    if dst.exists():
        return "skipped"
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return "copied"


def _run(albums: list[AlbumSuggestion], base: Path) -> None:
    flat = [(album.album_name, p) for album in albums for p in album.photo_paths]

    with _lock:
        _progress.update({
            "status": "running",
            "total": len(flat),
            "copied": 0,
            "skipped": 0,
            "current_file": "",
            "error": None,
            "result": None,
        })

    album_names: set[str] = set()
    total_copied = 0
    total_skipped = 0

    for album_name, src_path in flat:
        src = Path(src_path)
        dst = base / album_name / src.name
        with _lock:
            _progress["current_file"] = src.name
        outcome = _safe_copy(src, dst)
        album_names.add(album_name)
        if outcome == "copied":
            total_copied += 1
        else:
            total_skipped += 1
        with _lock:
            _progress["copied"] = total_copied
            _progress["skipped"] = total_skipped

    result = ExportResult(
        albums_created=len(album_names),
        photos_copied=total_copied,
        skipped=total_skipped,
        output_path=str(base),
    )
    with _lock:
        _progress.update({"status": "done", "result": result.model_dump()})


def start_export(albums: list[AlbumSuggestion], output_base_path: str) -> None:
    """Start a background export. No-ops if one is already running."""
    with _lock:
        if _progress["status"] == "running":
            return
    base = Path(output_base_path).expanduser().resolve()
    threading.Thread(target=_run, args=(albums, base), daemon=True).start()
