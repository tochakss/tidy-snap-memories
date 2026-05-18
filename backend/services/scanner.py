"""
Folder traversal and media metadata extraction.

scan_folder() walks a directory tree, identifies image/video files by MIME type,
extracts per-file metadata (size, timestamps, resolution), and returns a list
of MediaFile objects ready for the API response.
"""

from __future__ import annotations

import mimetypes
from datetime import datetime
from pathlib import Path
from typing import Optional

from models.media import MediaFile, MediaType

IMAGE_MIME_PREFIXES = ("image/",)
VIDEO_MIME_PREFIXES = ("video/",)

SUPPORTED_EXTENSIONS = {
    # images
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif",
    ".webp", ".heic", ".heif", ".raw", ".cr2", ".nef", ".arw",
    # videos
    ".mp4", ".mov", ".avi", ".mkv", ".wmv", ".flv", ".webm",
    ".m4v", ".3gp", ".ts", ".mts",
}


def _detect_media_type(mime: Optional[str]) -> MediaType:
    if mime is None:
        return MediaType.unknown
    if mime.startswith("image/"):
        return MediaType.image
    if mime.startswith("video/"):
        return MediaType.video
    return MediaType.unknown


def _extract_image_dimensions(path: Path) -> tuple[Optional[int], Optional[int]]:
    """Return (width, height) using Pillow; returns (None, None) on failure."""
    try:
        from PIL import Image  # type: ignore

        with Image.open(path) as img:
            return img.width, img.height
    except Exception:
        return None, None


def _extract_video_metadata(
    path: Path,
) -> tuple[Optional[int], Optional[int], Optional[float]]:
    """Return (width, height, duration_seconds) using cv2; None values on failure."""
    try:
        import cv2  # type: ignore

        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            return None, None, None
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or None
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or None
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        duration = (frame_count / fps) if fps and fps > 0 else None
        cap.release()
        return width, height, duration
    except Exception:
        return None, None, None


def _file_to_media(path: Path, mime: Optional[str]) -> MediaFile:
    stat = path.stat()
    media_type = _detect_media_type(mime)

    width = height = None
    duration = None

    if media_type == MediaType.image:
        width, height = _extract_image_dimensions(path)
    elif media_type == MediaType.video:
        width, height, duration = _extract_video_metadata(path)

    return MediaFile(
        path=str(path.resolve()),
        filename=path.name,
        media_type=media_type,
        size_bytes=stat.st_size,
        modified_at=datetime.fromtimestamp(stat.st_mtime),
        width=width,
        height=height,
        duration_seconds=duration,
        mime_type=mime,
    )


def scan_folder(
    folder_path: str,
    *,
    recursive: bool = True,
    include_videos: bool = True,
) -> list[MediaFile]:
    """
    Walk *folder_path* and return MediaFile metadata for every supported media file.

    Raises FileNotFoundError if the path does not exist.
    Raises PermissionError if the path is not readable.
    """
    root = Path(folder_path).expanduser().resolve()
    if not root.exists():
        raise FileNotFoundError(f"Folder not found: {folder_path}")
    if not root.is_dir():
        raise FileNotFoundError(f"Not a directory: {folder_path}")

    glob = root.rglob("*") if recursive else root.glob("*")

    results: list[MediaFile] = []
    for entry in glob:
        if not entry.is_file():
            continue
        if entry.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue

        mime, _ = mimetypes.guess_type(entry.name)
        media_type = _detect_media_type(mime)

        if media_type == MediaType.video and not include_videos:
            continue
        if media_type == MediaType.unknown:
            continue

        results.append(_file_to_media(entry, mime))

    return results
