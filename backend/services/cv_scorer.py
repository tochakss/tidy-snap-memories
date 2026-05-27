"""
OpenCV-based quality scoring for images and video thumbnails.

Metrics
-------
blur_score       Laplacian variance; higher = sharper.
brightness_score Mean pixel intensity 0–255.
overall_score    Composite 0–100 after content-aware bonuses/penalties.
faces_detected   True when ≥1 frontal face found.
face_count       Number of detected frontal faces.
content_type     "photo" | "screenshot" | "document"
is_outdoor       True when green/sky tones dominate ≥20% of the image.
is_pet           True when cat cascade fires or warm-fur heuristic matches.

Composite adjustments (cumulative, clamped to 0–100)
-----------------------------------------------------
  screenshot / document   − 40
  2+ faces                + 45  (+ 10 if child face present)
  1 face                  + 30  (+ 10 if child face present)
  body detected, no face  + 15
  pet, no face            + 20
  outdoor, no face/pet    + 10
"""

from __future__ import annotations

from pathlib import Path

import cv2  # type: ignore
import numpy as np

from models.media import ScoreResult
from services.scanner import scan_folder

BLUR_THRESHOLD = 100.0
PORTRAIT_BLUR_THRESHOLD = 30.0
DARK_THRESHOLD = 40.0
BRIGHT_THRESHOLD = 220.0

# ── Cascade singletons ──────────────────────────────────────────────────────

_face_cascade: cv2.CascadeClassifier | None = None
_body_cascade: cv2.CascadeClassifier | None = None
_cat_cascade: cv2.CascadeClassifier | None = None


def _load_cascade(filename: str) -> cv2.CascadeClassifier | None:
    xml = cv2.data.haarcascades + filename
    c = cv2.CascadeClassifier(xml)
    return c if not c.empty() else None


def _get_face_cascade() -> cv2.CascadeClassifier | None:
    global _face_cascade
    if _face_cascade is None:
        _face_cascade = _load_cascade("haarcascade_frontalface_default.xml")
    return _face_cascade


def _get_body_cascade() -> cv2.CascadeClassifier | None:
    global _body_cascade
    if _body_cascade is None:
        _body_cascade = _load_cascade("haarcascade_fullbody.xml")
    return _body_cascade


def _get_cat_cascade() -> cv2.CascadeClassifier | None:
    global _cat_cascade
    if _cat_cascade is None:
        _cat_cascade = _load_cascade("haarcascade_frontalcatface.xml")
    return _cat_cascade


# ── Image loading ───────────────────────────────────────────────────────────

def _load_bgr_and_gray(path: Path) -> tuple[np.ndarray | None, np.ndarray | None]:
    """Return (bgr, gray) for an image file or the mid-point frame of a video."""
    suffix = path.suffix.lower()
    video_exts = {".mp4", ".mov", ".avi", ".mkv", ".wmv", ".flv", ".webm", ".m4v"}

    if suffix in video_exts:
        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            return None, None
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, total // 2))
        ret, frame = cap.read()
        cap.release()
        if not ret:
            return None, None
        return frame, cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    bgr = cv2.imread(str(path))
    if bgr is None:
        return None, None
    return bgr, cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)


def _resize(img: np.ndarray, max_dim: int) -> np.ndarray:
    h, w = img.shape[:2]
    scale = min(1.0, max_dim / max(h, w, 1))
    if scale < 1.0:
        return cv2.resize(img, (int(w * scale), int(h * scale)))
    return img


# ── Detectors ───────────────────────────────────────────────────────────────

def _detect_faces_detail(gray: np.ndarray) -> tuple[int, bool]:
    """
    Return (face_count, has_child_face).
    Child heuristic: any detected face whose height is < 15% of the
    detection image height (small face → likely a child or group shot).
    """
    cascade = _get_face_cascade()
    if cascade is None:
        return 0, False

    small = _resize(gray, 640)
    faces = cascade.detectMultiScale(
        small,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(24, 24),
        flags=cv2.CASCADE_SCALE_IMAGE,
    )
    if not isinstance(faces, np.ndarray) or len(faces) == 0:
        return 0, False

    count = len(faces)
    child_threshold = small.shape[0] * 0.15
    has_child = any(int(fh) < child_threshold for _, _, _, fh in faces)
    return count, has_child


def _detect_body(gray: np.ndarray) -> bool:
    """Full-body detection used as fallback when no faces are found."""
    cascade = _get_body_cascade()
    if cascade is None:
        return False
    small = _resize(gray, 480)
    bodies = cascade.detectMultiScale(
        small,
        scaleFactor=1.05,
        minNeighbors=3,
        minSize=(30, 60),
    )
    return isinstance(bodies, np.ndarray) and len(bodies) > 0


def _detect_content_type(gray: np.ndarray) -> str:
    """
    Classify as 'screenshot', 'document', or 'photo'.

    Screenshots: ≥40% very-light pixels + matches a common screen aspect ratio.
    Documents:   ≥55% very-light pixels + meaningful edge density (text lines).
    """
    small = _resize(gray, 400)
    h, w = small.shape[:2]
    white_ratio = float(np.mean(small > 240))

    # Screenshot: high white AND matches 16:9 / 4:3 / 9:16 / etc.
    ar = w / h
    screen_ratios = [16 / 9, 4 / 3, 3 / 2, 9 / 16, 3 / 4, 2 / 3]
    if white_ratio > 0.40 and any(abs(ar - r) < 0.08 for r in screen_ratios):
        return "screenshot"

    # Document: very high white + edges that look like printed text
    if white_ratio > 0.55:
        edges = cv2.Canny(small, 50, 150)
        if float(np.mean(edges > 0)) > 0.03:
            return "document"

    return "photo"


def _detect_outdoor(bgr: np.ndarray) -> bool:
    """True when green vegetation or blue-sky tones cover ≥20% of the image."""
    small = _resize(bgr, 400)
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    green = cv2.inRange(hsv, (35, 40, 40), (85, 255, 255))
    sky = cv2.inRange(hsv, (100, 40, 100), (130, 255, 255))
    return float(np.mean(green > 0) + np.mean(sky > 0)) > 0.20


def _detect_pet(gray: np.ndarray, bgr: np.ndarray) -> bool:
    """
    True when a cat face is detected via Haar cascade, or warm-fur tones
    (golden/tan/brown) cover ≥15% of the image (rough dog heuristic).
    """
    cat = _get_cat_cascade()
    if cat is not None:
        small = _resize(gray, 480)
        cats = cat.detectMultiScale(
            small, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30)
        )
        if isinstance(cats, np.ndarray) and len(cats) > 0:
            return True

    small_bgr = _resize(bgr, 400)
    hsv = cv2.cvtColor(small_bgr, cv2.COLOR_BGR2HSV)
    warm_fur = cv2.inRange(hsv, (8, 50, 60), (30, 220, 220))
    return float(np.mean(warm_fur > 0)) > 0.15


# ── Base quality metrics ────────────────────────────────────────────────────

def _compute_scores(gray: np.ndarray) -> tuple[float, float]:
    blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    brightness = float(np.mean(gray))
    return blur, brightness


def _composite(blur: float, brightness: float) -> float:
    blur_norm = min(blur / 500.0, 1.0)
    if brightness < DARK_THRESHOLD:
        bright_norm = brightness / DARK_THRESHOLD * 0.5
    elif brightness > BRIGHT_THRESHOLD:
        bright_norm = 1.0 - (brightness - BRIGHT_THRESHOLD) / (255.0 - BRIGHT_THRESHOLD) * 0.5
    else:
        bright_norm = 0.5 + (brightness - DARK_THRESHOLD) / (BRIGHT_THRESHOLD - DARK_THRESHOLD) * 0.5
    return round((blur_norm * 0.7 + bright_norm * 0.3) * 100, 2)


# ── Memory score (called by scan.py) ───────────────────────────────────────

def _base_score(composite: float) -> int:
    if composite >= 80: return 9
    if composite >= 65: return 7
    if composite >= 50: return 5
    if composite >= 35: return 3
    return 2


def compute_memory_score(cv: ScoreResult) -> tuple[int, str, bool]:
    """
    Derive (memory_score 1–10, reason, keep) from a ScoreResult.

    Priority order (highest wins):
      1. Screenshots / documents → score 1–2, keep=False
      2. 2+ faces → score min 8
      3. 1 face   → score min 6
      4. Pets     → score min 5
      5. Outdoor  → score min 4
      6. Generic  → score by composite
    """
    composite = cv.overall_score

    if cv.content_type == "screenshot":
        return 1, "Screenshot — not a memory photo", False

    if cv.content_type == "document":
        return 2, "Document or text image — low memory value", False

    if cv.face_count >= 2:
        quality = "good quality" if composite >= 50 else "low quality"
        score = min(10, max(8, _base_score(composite)))
        return score, f"Family moment — {cv.face_count} faces detected, {quality}", True

    if cv.face_count == 1:
        score = min(10, max(6, _base_score(composite)))
        return score, "Good portrait — face detected", True

    if cv.is_pet:
        score = min(10, max(5, _base_score(composite)))
        return score, "Pet photo detected", composite >= 35

    if cv.is_outdoor:
        score = max(4, _base_score(composite))
        return score, "Outdoor photo — good composition", composite >= 40

    reason = "Good quality photo" if composite >= 50 else "Blurry or dark photo"
    return _base_score(composite), reason, composite >= 50


# ── Public API ──────────────────────────────────────────────────────────────

def score_file(path: str) -> ScoreResult:
    """Compute quality metrics for a single file. Raises FileNotFoundError if missing."""
    p = Path(path).resolve()
    if not p.exists():
        raise FileNotFoundError(f"File not found: {path}")

    bgr, gray = _load_bgr_and_gray(p)
    if gray is None:
        return ScoreResult(
            path=path,
            blur_score=0.0,
            brightness_score=0.0,
            is_blurry=True,
            is_dark=True,
            overall_score=0.0,
            faces_detected=False,
            face_count=0,
            content_type="photo",
            is_outdoor=False,
            is_pet=False,
        )

    blur, brightness = _compute_scores(gray)
    base_composite = _composite(blur, brightness)

    # Content type first — determines penalty direction
    content_type = _detect_content_type(gray)

    # Person detection
    face_count, has_child = _detect_faces_detail(gray)
    body_detected = _detect_body(gray) if face_count == 0 else False

    # Pet & outdoor only for genuine photos
    is_pet = False
    is_outdoor = False
    if content_type == "photo" and bgr is not None:
        is_pet = _detect_pet(gray, bgr)
        is_outdoor = _detect_outdoor(bgr)

    # Apply bonuses / penalties
    composite = base_composite
    if content_type in ("screenshot", "document"):
        composite -= 40
    elif face_count >= 2:
        composite += 45 + (10 if has_child else 0)
    elif face_count == 1:
        composite += 30 + (10 if has_child else 0)
    elif body_detected:
        composite += 15

    if is_pet and face_count == 0:
        composite += 20
    if is_outdoor and face_count == 0 and not is_pet:
        composite += 10

    composite = round(max(0.0, min(100.0, composite)), 2)
    blur_threshold = PORTRAIT_BLUR_THRESHOLD if face_count > 0 else BLUR_THRESHOLD

    return ScoreResult(
        path=path,
        blur_score=round(blur, 4),
        brightness_score=round(brightness, 4),
        is_blurry=blur < blur_threshold,
        is_dark=brightness < DARK_THRESHOLD,
        overall_score=composite,
        faces_detected=face_count > 0,
        face_count=face_count,
        content_type=content_type,
        is_outdoor=is_outdoor,
        is_pet=is_pet,
    )


def score_files(
    paths: list[str] | None = None,
    folder_path: str | None = None,
) -> list[ScoreResult]:
    """Score a list of paths, or every media file under folder_path."""
    if folder_path:
        media = scan_folder(folder_path, recursive=True, include_videos=True)
        targets = [mf.path for mf in media]
    else:
        targets = list(paths or [])
    return [score_file(p) for p in targets]
