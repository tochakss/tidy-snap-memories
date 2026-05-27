"""
AI provider abstraction layer for TidySnaps.

Supports three backends, selected per-request via the 'provider' param:
  - "ollama"  — local Ollama server (default, free, zero API cost)
  - "claude"  — Anthropic Claude Haiku (fast, low-cost)
  - "grok"    — xAI Grok via OpenAI-compatible endpoint

All backends receive a base64-encoded thumbnail and return structured JSON.
Raw file paths are NEVER sent to any external API.
"""

from __future__ import annotations

import base64
import json
import os
from pathlib import Path

from models.media import PublishResult

# --------------------------------------------------------------------------- #
# Thumbnail helpers                                                             #
# --------------------------------------------------------------------------- #

THUMBNAIL_MAX_DIM = 512  # pixels


def _thumbnail_b64(path: Path) -> str:
    """Return a base64-encoded JPEG thumbnail of *path* (image or video frame)."""
    import cv2  # type: ignore
    import numpy as np

    suffix = path.suffix.lower()
    video_exts = {".mp4", ".mov", ".avi", ".mkv", ".wmv", ".flv", ".webm", ".m4v"}

    if suffix in video_exts:
        cap = cv2.VideoCapture(str(path))
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, total // 2))
        ret, frame = cap.read()
        cap.release()
        img = frame if ret else np.zeros((64, 64, 3), dtype=np.uint8)
    else:
        img = cv2.imread(str(path))
        if img is None:
            img = np.zeros((64, 64, 3), dtype=np.uint8)

    h, w = img.shape[:2]
    if max(h, w) > THUMBNAIL_MAX_DIM:
        scale = THUMBNAIL_MAX_DIM / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)))

    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 75])
    return base64.b64encode(buf.tobytes()).decode()


def _build_prompt(filename: str, context: str) -> str:
    return (
        f"You are a YouTube content expert. Given a media file named '{filename}'"
        + (f" described as: {context}." if context else ".")
        + " Generate a compelling YouTube upload package as JSON with keys: "
        "'title' (string, ≤70 chars), 'description' (string, 2–3 sentences), "
        "'tags' (list of 5–10 strings), 'suggested_category' (string). "
        "Respond ONLY with valid JSON, no markdown fences."
    )


def _parse_response(raw: str, path: str) -> PublishResult:
    data = json.loads(raw)
    return PublishResult(
        path=path,
        title=data["title"],
        description=data["description"],
        tags=data.get("tags", []),
        suggested_category=data.get("suggested_category"),
    )


# --------------------------------------------------------------------------- #
# Provider implementations                                                      #
# --------------------------------------------------------------------------- #

def _call_ollama(prompt: str, thumb_b64: str) -> str:
    import httpx  # type: ignore

    url = os.getenv("OLLAMA_URL", "http://localhost:11434") + "/api/generate"
    model = os.getenv("OLLAMA_MODEL", "moondream:latest")

    payload = {
        "model": model,
        "prompt": prompt,
        "images": [thumb_b64],
        "stream": False,
    }
    print(f"Sending image to {model}...")
    try:
        r = httpx.post(url, json=payload, timeout=30)
        print(f"Ollama response status: {r.status_code}")
        print(f"Ollama response: {r.text[:200]}")
        r.raise_for_status()
        return r.json()["response"]
    except Exception as e:
        print(f"Ollama error: {str(e)}")
        raise


def _call_claude(prompt: str, thumb_b64: str) -> str:
    import anthropic  # type: ignore

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=512,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": thumb_b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )
    return msg.content[0].text


def _call_deepseek(prompt: str) -> str:
    """Text-only call — sends CV metrics, no image (DeepSeek-V4-Flash has no vision API)."""
    import httpx  # type: ignore

    api_key = os.environ["DEEPSEEK_API_KEY"]
    payload = {
        "model": "deepseek-v4-flash",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 100,
    }
    r = httpx.post(
        "https://api.deepseek.com/chat/completions",
        json=payload,
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


def _call_grok(prompt: str, thumb_b64: str) -> str:
    import httpx  # type: ignore

    url = os.getenv("GROK_BASE_URL", "https://api.x.ai/v1") + "/chat/completions"
    api_key = os.environ["GROK_API_KEY"]
    model = os.getenv("GROK_MODEL", "grok-2-vision-1212")

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{thumb_b64}"},
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
        "max_tokens": 512,
    }
    r = httpx.post(url, json=payload, headers={"Authorization": f"Bearer {api_key}"}, timeout=30)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


# --------------------------------------------------------------------------- #
# Public interface                                                              #
# --------------------------------------------------------------------------- #

_PROVIDERS = {
    "ollama": _call_ollama,
    "claude": _call_claude,
    "grok": _call_grok,
}


def _build_curation_prompt(filename: str) -> str:
    """Prompt for Claude / Grok — supports system-style framing."""
    return (
        f"You are a photo memory curator. Analyse this photo named '{filename}'. "
        "Respond ONLY with valid JSON (no markdown fences, no extra text) containing exactly these keys: "
        '"memory_score" (integer 1–10, where 10 = extremely memorable moment, 1 = blurry/boring/should delete), '
        '"reason" (string, one sentence explaining the score), '
        '"keep" (boolean, true if worth keeping), '
        '"faces_detected" (boolean, true if human faces are clearly visible).'
    )


def _build_moondream_prompt() -> str:
    """Compact prompt for moondream — inline JSON schema, no markdown fences."""
    return (
        'Rate this photo for memory value. Reply with JSON only, no markdown backticks: '
        '{"memory_score": 1-10, "reason": "one sentence", '
        '"keep": true/false, "faces_detected": true/false}'
    )


def probe_ollama() -> None:
    """
    Smoke-test the configured Ollama model with a 1-pixel image.
    Raises RuntimeError with a pull hint if the model is missing or the
    server is unreachable.
    """
    import httpx  # type: ignore

    model = os.getenv("OLLAMA_MODEL", "moondream:latest")
    base_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
    print("Testing Ollama connection...")
    try:
        r = httpx.get(f"{base_url}/api/tags", timeout=10)
        r.raise_for_status()
        models = r.json().get("models", [])
        model_names = [m["name"] for m in models]
        print(f"Models found: {model_names}")
        if not any("moondream" in name for name in model_names):
            raise RuntimeError(
                f"Ollama moondream model not found — run: ollama pull {model}"
            )
    except RuntimeError:
        raise
    except Exception as exc:
        print(f"Ollama error: {str(exc)}")
        raise RuntimeError(
            f"Ollama moondream model not responding — run: ollama pull {model}"
        ) from exc


def _parse_curation(raw: str) -> dict:
    text = raw.strip()
    start, end = text.find("{"), text.rfind("}") + 1
    if 0 <= start < end:
        text = text[start:end]
    data = json.loads(text)
    return {
        "memory_score": max(1, min(10, int(data.get("memory_score", 5)))),
        "reason": str(data.get("reason", "")),
        "keep": bool(data.get("keep", True)),
        "faces_detected": bool(data.get("faces_detected", False)),
    }


def _build_deepseek_curation_prompt(
    filename: str,
    sharpness: float,
    brightness: float,
    composite: float,
    faces: bool,
) -> str:
    return (
        f"A photo has these quality metrics:\n"
        f"sharpness: {sharpness:.0f}/100\n"
        f"brightness: {brightness:.0f}/100\n"
        f"composite_score: {composite:.0f}/100\n"
        f"faces_detected: {str(faces).lower()}\n"
        f"filename: {filename}\n\n"
        "Based on these metrics, rate this photo as a memory.\n"
        'Reply with JSON only: {"memory_score": 1-10, "reason": "one sentence", "keep": true/false}'
    )


def score_memory_deepseek(
    filename: str,
    sharpness: float,
    brightness: float,
    composite: float,
    faces: bool,
) -> dict:
    """
    Score a photo using CV metrics sent as text to DeepSeek.
    No image is transmitted — only the numeric metrics derived from local CV scoring.
    """
    prompt = _build_deepseek_curation_prompt(filename, sharpness, brightness, composite, faces)
    raw = _call_deepseek(prompt)
    parsed = _parse_curation(raw)
    # DeepSeek never sees the image, so trust the CV face result instead
    parsed["faces_detected"] = faces
    return parsed


def score_memory(path: str, provider: str = "ollama") -> dict:
    """Score a single media file using AI vision. Returns memory_score, reason, keep, faces_detected."""
    if provider not in _PROVIDERS:
        raise ValueError(f"Unknown provider '{provider}'")
    p = Path(path).resolve()
    if not p.exists():
        raise FileNotFoundError(f"File not found: {path}")
    thumb_b64 = _thumbnail_b64(p)
    # moondream expects a compact inline-JSON prompt; other providers get the richer framing
    prompt = _build_moondream_prompt() if provider == "ollama" else _build_curation_prompt(p.name)
    raw = _PROVIDERS[provider](prompt, thumb_b64)
    return _parse_curation(raw)


def call_ai_text(prompt: str, provider: str = "claude") -> str:
    """Text-only AI call — no image attached. Used for album naming and similar tasks."""
    if provider == "claude":
        import anthropic  # type: ignore
        client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text

    if provider == "grok":
        import httpx  # type: ignore
        url = os.getenv("GROK_BASE_URL", "https://api.x.ai/v1") + "/chat/completions"
        api_key = os.environ["GROK_API_KEY"]
        r = httpx.post(
            url,
            json={"model": "grok-2-1212", "messages": [{"role": "user", "content": prompt}], "max_tokens": 256},
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]

    # Default: Ollama text-only via /api/generate (no images field)
    import httpx  # type: ignore
    url = os.getenv("OLLAMA_URL", "http://localhost:11434") + "/api/generate"
    model = os.getenv("OLLAMA_MODEL", "moondream:latest")
    r = httpx.post(
        url,
        json={"model": model, "prompt": prompt, "stream": False},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["response"]


def generate_publish_metadata(
    path: str,
    context: str = "",
    provider: str = "ollama",
) -> PublishResult:
    """
    Generate YouTube metadata for *path* using the named AI provider.

    Raises ValueError for unknown providers.
    Raises FileNotFoundError if the file is missing.
    """
    if provider not in _PROVIDERS:
        raise ValueError(f"Unknown provider '{provider}'. Choose from: {list(_PROVIDERS)}")

    p = Path(path).resolve()
    if not p.exists():
        raise FileNotFoundError(f"File not found: {path}")

    thumb_b64 = _thumbnail_b64(p)
    prompt = _build_prompt(p.name, context)
    raw = _PROVIDERS[provider](prompt, thumb_b64)
    return _parse_response(raw, path)
