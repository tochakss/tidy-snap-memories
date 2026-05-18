"""
GPS extraction, location-based photo grouping, and AI-assisted album naming.
"""

from __future__ import annotations

import json
import math
from datetime import datetime
from pathlib import Path
from typing import Optional


# ── GPS extraction ─────────────────────────────────────────────────────────────

def _dms_to_decimal(dms: tuple, ref: str) -> float:
    d, m, s = (float(x) for x in dms)
    dec = d + m / 60 + s / 3600
    return -dec if ref in ("S", "W") else dec


def extract_gps(file_path: str) -> Optional[tuple[float, float]]:
    """Return (lat, lon) from EXIF GPS tags, or None if unavailable."""
    try:
        from PIL import Image  # type: ignore
        from PIL.ExifTags import GPSTAGS, TAGS  # type: ignore

        img = Image.open(file_path)
        raw = img._getexif()  # type: ignore[attr-defined]
        if not raw:
            return None

        gps: dict = {}
        for tag_id, val in raw.items():
            if TAGS.get(tag_id) == "GPSInfo":
                for k, v in val.items():
                    gps[GPSTAGS.get(k, k)] = v

        if "GPSLatitude" in gps and "GPSLongitude" in gps:
            lat = _dms_to_decimal(gps["GPSLatitude"], gps.get("GPSLatitudeRef", "N"))
            lon = _dms_to_decimal(gps["GPSLongitude"], gps.get("GPSLongitudeRef", "E"))
            return (lat, lon)
    except Exception:
        pass
    return None


# ── Spatial helpers ────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat, dlon = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


# ── Grouping ───────────────────────────────────────────────────────────────────

def group_photos_by_location(
    file_paths: list[str],
    radius_km: float = 0.5,
) -> tuple[list[dict], list[str]]:
    """
    Cluster photos taken within *radius_km* AND within 7 days into the same group.
    Returns (groups, no_gps_paths).
    Each group dict: {photos: list[{path, lat, lon, mtime}], center_lat, center_lon}
    """
    tagged: list[dict] = []
    no_gps: list[str] = []

    for path in file_paths:
        gps = extract_gps(path)
        if gps:
            tagged.append({"path": path, "lat": gps[0], "lon": gps[1], "mtime": Path(path).stat().st_mtime})
        else:
            no_gps.append(path)

    groups: list[dict] = []
    for photo in tagged:
        assigned = False
        for g in groups:
            dist = _haversine_km(photo["lat"], photo["lon"], g["center_lat"], g["center_lon"])
            if dist > radius_km:
                continue
            mtimes = [p["mtime"] for p in g["photos"]]
            days_span = (max(max(mtimes), photo["mtime"]) - min(min(mtimes), photo["mtime"])) / 86_400
            if days_span <= 7:
                g["photos"].append(photo)
                n = len(g["photos"])
                g["center_lat"] = (g["center_lat"] * (n - 1) + photo["lat"]) / n
                g["center_lon"] = (g["center_lon"] * (n - 1) + photo["lon"]) / n
                assigned = True
                break
        if not assigned:
            groups.append({"photos": [photo], "center_lat": photo["lat"], "center_lon": photo["lon"]})

    return groups, no_gps


# ── Album naming ───────────────────────────────────────────────────────────────

def name_album(
    place_name: str,
    date_range: str,
    year: int,
    provider: str = "claude",
) -> str:
    """
    Generate a warm album name using AI. Always includes *year* at the end.
    Falls back to "{place_name} {year}" if the AI call fails.
    """
    prompt = (
        f"Create a warm, memorable album name for a photo collection.\n"
        f"Location: {place_name}\n"
        f"Dates: {date_range}\n"
        f"Examples: 'Dubai Family Visit 2024', 'Tokyo Spring Trip 2023', 'Algarve Beach Holiday 2024'\n"
        f"Rules: include the year ({year}) at the end. Use 2–5 words before the year. "
        f"Make it warm and personal, not generic.\n"
        f"Respond ONLY with valid JSON: {{\"album_name\": \"...\"}}. No other text."
    )
    try:
        from services.ai_provider import call_ai_text  # imported here to avoid circular at module load

        raw = call_ai_text(prompt, provider=provider)
        text = raw.strip()
        start, end = text.find("{"), text.rfind("}") + 1
        if 0 <= start < end:
            text = text[start:end]
        data = json.loads(text)
        name = str(data.get("album_name", "")).strip()
        if name and str(year) in name:
            return name
    except Exception:
        pass

    return f"{place_name} {year}"
