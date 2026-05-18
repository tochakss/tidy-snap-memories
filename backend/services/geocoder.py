"""
Reverse geocoder using OpenStreetMap Nominatim (free, no API key required).
Rate-limited to 1 request/second as required by the Nominatim usage policy.
Results are cached by rounded coordinates (~111 m precision) to avoid duplicate calls.
"""

from __future__ import annotations

import time

import httpx

_cache: dict[tuple[float, float], str] = {}
_last_call_ts: float = 0.0
_ROUND = 3  # ~111 m — sufficient for album grouping


def _key(lat: float, lon: float) -> tuple[float, float]:
    return (round(lat, _ROUND), round(lon, _ROUND))


def reverse_geocode(lat: float, lon: float) -> str:
    """Return the most useful place name for the given coordinates."""
    global _last_call_ts

    key = _key(lat, lon)
    if key in _cache:
        return _cache[key]

    # Honour the 1 req/sec Nominatim rate limit
    wait = 1.0 - (time.monotonic() - _last_call_ts)
    if wait > 0:
        time.sleep(wait)

    try:
        r = httpx.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": lat, "lon": lon, "format": "json"},
            headers={"User-Agent": "TidySnaps/1.0 (local photo organiser; contact@tidysnaps.app)"},
            timeout=10,
        )
        _last_call_ts = time.monotonic()
        r.raise_for_status()
        addr = r.json().get("address", {})

        # Prefer the most specific useful name
        name = (
            addr.get("tourism")
            or addr.get("amenity")
            or addr.get("suburb")
            or addr.get("city_district")
            or addr.get("city")
            or addr.get("town")
            or addr.get("village")
            or addr.get("county")
            or addr.get("state")
            or addr.get("country")
            or "Unknown Location"
        )
    except Exception:
        _last_call_ts = time.monotonic()
        name = "Unknown Location"

    _cache[key] = name
    return name
