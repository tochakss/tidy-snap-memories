"""
OpenCV-based quality scoring for images and video thumbnails.

Metrics
-------
blur_score      Laplacian variance of the luminance channel.
                Higher = sharper. Threshold: < 100 → blurry.
brightness_score  Mean pixel intensity (0–255) in grayscale.
                  < 40 → too dark; > 220 → over-exposed.
overall_score   Composite 0–100 derived from the two metrics above.
"""

from __future__ import annotations

from pathlib import Path

import cv2  # type: ignore
import numpy as np

from models.media import MediaType, ScoreResult
from services.scanner import scan_folder

BLUR_THRESHOLD = 100.0
DARK_THRESHOLD = 40.0
BRIGHT_THRESHOLD = 220.0


def _load_gray(path: Path) -> np.ndarray | None:
    """Return a grayscale numpy array for an image or the middle frame of a video."""
    suffix = path.suffix.lower()
    video_exts = {".mp4", ".mov", ".avi", ".mkv", ".wmv", ".flv", ".webm", ".m4v"}

    if suffix in video_exts:
        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            return None
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, total // 2))
        ret, frame = cap.read()
        cap.release()
        if not ret:
            return None
        return cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    img = cv2.imread(str(path))
    if img is None:
        return None
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)


def _compute_scores(gray: np.ndarray) -> tuple[float, float]:
    blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(np.mean(gray))
    return blur, brightness


def _composite(blur: float, brightness: float) -> float:
    """Combine blur and brightness into a 0–100 quality score."""
    blur_norm = min(blur / 500.0, 1.0)  # 500+ = very sharp
    if brightness < DARK_THRESHOLD:
        bright_norm = brightness / DARK_THRESHOLD * 0.5
    elif brightness > BRIGHT_THRESHOLD:
        bright_norm = 1.0 - (brightness - BRIGHT_THRESHOLD) / (255.0 - BRIGHT_THRESHOLD) * 0.5
    else:
        bright_norm = 0.5 + (brightness - DARK_THRESHOLD) / (BRIGHT_THRESHOLD - DARK_THRESHOLD) * 0.5
    return round((blur_norm * 0.7 + bright_norm * 0.3) * 100, 2)


def score_file(path: str) -> ScoreResult:
    """Compute quality metrics for a single file. Raises FileNotFoundError if missing."""
    p = Path(path).resolve()
    if not p.exists():
        raise FileNotFoundError(f"File not found: {path}")

    gray = _load_gray(p)
    if gray is None:
        return ScoreResult(
            path=path,
            blur_score=0.0,
            brightness_score=0.0,
            is_blurry=True,
            is_dark=True,
            overall_score=0.0,
        )

    blur, brightness = _compute_scores(gray)
    return ScoreResult(
        path=path,
        blur_score=round(blur, 4),
        brightness_score=round(brightness, 4),
        is_blurry=blur < BLUR_THRESHOLD,
        is_dark=brightness < DARK_THRESHOLD,
        overall_score=_composite(blur, brightness),
    )


def score_files(
    paths: list[str] | None = None,
    folder_path: str | None = None,
) -> list[ScoreResult]:
    """
    Score a list of explicit paths, or every media file inside *folder_path*.
    At least one of the two arguments must be provided.
    """
    if folder_path:
        media = scan_folder(folder_path, recursive=True, include_videos=True)
        targets = [mf.path for mf in media]
    else:
        targets = list(paths or [])

    return [score_file(p) for p in targets]
