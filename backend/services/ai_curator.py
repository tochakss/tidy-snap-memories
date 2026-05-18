"""
Background AI curation service.

Scans a folder, runs CV scoring + AI memory scoring on each file, and
maintains a global progress dict that /api/scan/ai/progress can poll.

Only one scan runs at a time — concurrent start() calls are ignored.
"""

from __future__ import annotations

import threading
from typing import Any
from urllib.parse import quote

from models.media import ScoredMedia
from services.cv_scorer import score_file
from services.ai_provider import score_memory
from services.scanner import scan_folder

# ── Global progress state ──────────────────────────────────────────────────────

_lock = threading.Lock()
_progress: dict[str, Any] = {
    "status": "idle",
    "total": 0,
    "completed": 0,
    "results": [],
    "error": None,
}


def get_progress() -> dict[str, Any]:
    with _lock:
        return dict(_progress)


# ── Worker ─────────────────────────────────────────────────────────────────────

def _run(folder_path: str, provider: str) -> None:
    try:
        media = scan_folder(folder_path, recursive=True, include_videos=True)
    except Exception as exc:
        with _lock:
            _progress.update({"status": "error", "error": str(exc)})
        return

    with _lock:
        _progress.update({
            "status": "running",
            "total": len(media),
            "completed": 0,
            "results": [],
            "error": None,
        })

    results: list[dict] = []
    for i, mf in enumerate(media):
        try:
            cv = score_file(mf.path)
            ai = score_memory(mf.path, provider=provider)
            scored = ScoredMedia(
                file_path=mf.path,
                filename=mf.filename,
                thumbnail_url=f"http://localhost:8000/api/file?path={quote(mf.path)}",
                sharpness=cv.blur_score,
                brightness=cv.brightness_score,
                composite_score=cv.overall_score,
                memory_score=ai["memory_score"],
                ai_reason=ai["reason"],
                keep_suggested=ai["keep"],
                faces_detected=ai["faces_detected"],
            )
            results.append(scored.model_dump())
        except Exception:
            pass  # skip failed files; don't abort the whole scan

        with _lock:
            _progress["completed"] = i + 1

    with _lock:
        _progress.update({"status": "done", "results": results})


def start_ai_scan(folder_path: str, provider: str = "ollama") -> None:
    """Start a background AI scan. No-ops if a scan is already running."""
    with _lock:
        if _progress["status"] == "running":
            return

    t = threading.Thread(target=_run, args=(folder_path, provider), daemon=True)
    t.start()
