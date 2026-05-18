"""
Pydantic models shared across TidySnaps routers.

MediaFile       — a single media asset with filesystem metadata.
DuplicateGroup  — a cluster of files that are exact or near-duplicate matches.
ScoreResult     — CV quality metrics for one file.
PublishResult   — AI-generated YouTube metadata for one file.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class MediaType(str, Enum):
    image = "image"
    video = "video"
    unknown = "unknown"


class MediaFile(BaseModel):
    """Represents a single media file discovered during a scan."""

    path: str = Field(..., description="Absolute path to the file")
    filename: str
    media_type: MediaType
    size_bytes: int
    modified_at: datetime
    width: Optional[int] = None
    height: Optional[int] = None
    duration_seconds: Optional[float] = None  # videos only
    mime_type: Optional[str] = None


class DuplicateGroup(BaseModel):
    """A cluster of files that share identical or near-identical content."""

    group_id: str = Field(..., description="SHA256 hash or perceptual hash root")
    match_type: str = Field(..., description="'exact' | 'near'")
    files: list[MediaFile]
    recommended_keep: Optional[str] = Field(
        None, description="Path of the file recommended to keep"
    )


class ScoreResult(BaseModel):
    """Computer-vision quality scores for a single media file."""

    path: str
    blur_score: float = Field(..., description="Laplacian variance; higher = sharper")
    brightness_score: float = Field(..., description="Mean luminance 0–255")
    is_blurry: bool
    is_dark: bool
    overall_score: float = Field(..., description="Composite 0–100 quality score")


class PublishResult(BaseModel):
    """AI-generated YouTube metadata for a media file."""

    path: str
    title: str
    description: str
    tags: list[str]
    suggested_category: Optional[str] = None


class AlbumSuggestion(BaseModel):
    """A suggested photo album derived from GPS clustering."""

    album_name: str
    photo_count: int
    date_range: str
    location: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    photo_paths: list[str]


class ExportResult(BaseModel):
    """Result of copying albums to an output folder."""

    albums_created: int
    photos_copied: int
    skipped: int
    output_path: str


class SyncResult(BaseModel):
    """Result of a sync preview or confirmed copy."""

    new_photos_found: int
    albums_updated: int
    new_albums_created: int
    preview: list[AlbumSuggestion]
    confirmed: bool


class ScoredMedia(BaseModel):
    """AI + CV quality scores for a single media file."""

    file_path: str
    filename: str
    thumbnail_url: str = Field(..., description="URL to serve the file via /api/file")
    sharpness: float = Field(..., description="Laplacian variance — higher = sharper")
    brightness: float = Field(..., description="Mean luminance 0–255")
    composite_score: float = Field(..., description="CV composite 0–100")
    memory_score: int = Field(..., ge=1, le=10, description="AI memory score 1–10")
    ai_reason: str
    keep_suggested: bool
    faces_detected: bool
