"""
Background AI curation service.

Improvements over v1:
- Per-photo 30 s timeout (httpx + concurrent.futures) — skips hung photos
- Batch size 5: checkpoints every SAVE_EVERY photos to scan_progress.json
- Resume: if scan_progress.json has in_progress=true, _run() resumes where
  it left off instead of restarting from scratch
"""

from __future__ import annotations

import concurrent.futures
import json
import threading
from pathlib import Path
from typing import Any
from urllib.parse import quote

from models.media import ScoredMedia
from services.cv_scorer import score_file
from services.ai_provider import score_memory
from services.scanner import scan_folder

PHOTO_TIMEOUT = 30   # seconds; skips single photo on timeout
SAVE_EVERY = 5       # checkpoint frequency (photos)
PROGRESS_FILE = Path(__file__).parent.parent / "scan_progress.json"

# ── Global in-memory state ─────────────────────────────────────────────────────

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


# ── Progress-file helpers ──────────────────────────────────────────────────────

def _save_progress(
    folder_path: str,
    provider: str,
    completed: list[str],
    failed: list[str],
    results: list[dict],
    total: int,
    in_progress: bool,
) -> None:
    try:
        PROGRESS_FILE.write_text(
            json.dumps(
                {
                    "folder_path": folder_path,
                    "provider": provider,
                    "completed": completed,
                    "failed": failed,
                    "results": results,
                    "total": total,
                    "in_progress": in_progress,
                },
                indent=2,
            )
        )
    except Exception:
        pass  # non-critical; don't abort the scan


def _load_progress() -> dict | None:
    try:
        if PROGRESS_FILE.exists():
            return json.loads(PROGRESS_FILE.read_text())
    except Exception:
        pass
    return None


def _delete_progress() -> None:
    try:
        PROGRESS_FILE.unlink(missing_ok=True)
    except Exception:
        pass


# ── Per-photo scoring with hard timeout ───────────────────────────────────────

def _score_one(mf: Any, provider: str) -> dict | None:
    """
    Score a single file within PHOTO_TIMEOUT seconds.
    Returns the scored dict or None on any failure/timeout.
    """
    def _work() -> dict:
        cv = score_file(mf.path)
        ai = score_memory(mf.path, provider=provider)
        return ScoredMedia(
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
        ).model_dump()

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as exe:
        future = exe.submit(_work)
        try:
            return future.result(timeout=PHOTO_TIMEOUT)
        except (concurrent.futures.TimeoutError, Exception):
            return None


# ── Worker ─────────────────────────────────────────────────────────────────────

def _run(
    folder_path: str,
    provider: str,
    already_done: set[str] | None = None,
    prior_results: list[dict] | None = None,
) -> None:
    try:
        media = scan_folder(folder_path, recursive=True, include_videos=True)
    except Exception as exc:
        with _lock:
            _progress.update({"status": "error", "error": str(exc)})
        _delete_progress()
        return

    already_done = already_done or set()
    results: list[dict] = list(prior_results or [])
    completed_paths: list[str] = list(already_done)
    failed_paths: list[str] = []

    # Only process files not yet completed
    remaining = [mf for mf in media if mf.path not in already_done]

    with _lock:
        _progress.update({
            "status": "running",
            "total": len(media),
            "completed": len(already_done),
            "results": results,
            "error": None,
        })

    for i, mf in enumerate(remaining):
        scored = _score_one(mf, provider)
        if scored is not None:
            results.append(scored)
            completed_paths.append(mf.path)
        else:
            failed_paths.append(mf.path)

        new_completed = len(already_done) + i + 1
        with _lock:
            _progress["completed"] = new_completed
            _progress["results"] = results

        # Checkpoint every SAVE_EVERY photos
        if new_completed % SAVE_EVERY == 0:
            _save_progress(
                folder_path, provider,
                completed_paths, failed_paths,
                results, len(media), in_progress=True,
            )

    # Final write — mark complete
    _save_progress(
        folder_path, provider,
        completed_paths, failed_paths,
        results, len(media), in_progress=False,
    )

    with _lock:
        _progress.update({"status": "done", "results": results})


# ── Public API ─────────────────────────────────────────────────────────────────

def start_ai_scan(folder_path: str, provider: str = "ollama") -> None:
    """
    Start a fresh scan.

    Clears any previous progress file and resets in-memory state so stale
    results from a failed previous run are never shown.

    For the ollama provider, probes the model with a test image first.
    Raises RuntimeError (→ HTTP 503) if the model is not available.
    """
    with _lock:
        if _progress["status"] == "running":
            return

    # Probe before touching any state — raises RuntimeError on failure
    if provider == "ollama":
        from services.ai_provider import probe_ollama  # avoid circular at module level
        probe_ollama()

    _delete_progress()
    with _lock:
        _progress.update({
            "status": "idle",
            "total": 0,
            "completed": 0,
            "results": [],
            "error": None,
        })

    threading.Thread(target=_run, args=(folder_path, provider), daemon=True).start()


def resume_ai_scan() -> dict:
    """
    Resume from scan_progress.json if an incomplete scan exists.
    Returns a status dict; callers should poll /scan/ai/progress afterwards.
    """
    saved = _load_progress()
    if not saved or not saved.get("in_progress"):
        return {"status": "no_incomplete_scan"}

    with _lock:
        if _progress["status"] == "running":
            return {"status": "already_running", "completed": _progress["completed"], "total": _progress["total"]}

    folder_path = saved["folder_path"]
    provider = saved.get("provider", "ollama")
    done_set = set(saved.get("completed", []))
    prior_results = saved.get("results", [])
    total = saved.get("total", 0)

    # Seed in-memory state immediately so the progress endpoint reflects reality
    with _lock:
        _progress.update({
            "status": "running",
            "total": total,
            "completed": len(done_set),
            "results": prior_results,
            "error": None,
        })

    threading.Thread(
        target=_run,
        args=(folder_path, provider, done_set, prior_results),
        daemon=True,
    ).start()

    return {
        "status": "resumed",
        "completed": len(done_set),
        "total": total,
        "folder_path": folder_path,
    }


def check_incomplete_scan() -> dict:
    """
    Read scan_progress.json without starting anything.
    Used by the frontend to decide whether to show a 'Resume Scan' prompt.
    """
    saved = _load_progress()
    if not saved or not saved.get("in_progress"):
        return {"has_incomplete": False}
    return {
        "has_incomplete": True,
        "completed": len(saved.get("completed", [])),
        "total": saved.get("total", 0),
        "folder_path": saved.get("folder_path", ""),
    }
