"""
Duplicate detection: exact match via SHA-256, near-duplicate via perceptual hash.

find_duplicates() scans a folder, groups files by hash, and returns DuplicateGroup
objects. The 'recommended_keep' field in each group points to the highest-resolution
(or largest) file — a heuristic that works well for burst-shot and re-save duplicates.
"""

from __future__ import annotations

import hashlib
import uuid
from collections import defaultdict
from pathlib import Path

import imagehash  # type: ignore
from PIL import Image  # type: ignore

from models.media import DuplicateGroup, MediaFile, MediaType
from services.scanner import scan_folder

PHASH_THRESHOLD = 10  # hamming distance ≤ this → near-duplicate


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _phash(path: Path) -> imagehash.ImageHash | None:
    try:
        with Image.open(path) as img:
            return imagehash.phash(img)
    except Exception:
        return None


def _best_to_keep(files: list[MediaFile]) -> str:
    """Return the path of the file that should be kept (highest resolution, then largest)."""
    def key(f: MediaFile) -> tuple[int, int]:
        pixels = (f.width or 0) * (f.height or 0)
        return (pixels, f.size_bytes)

    return max(files, key=key).path


def find_duplicates(
    folder_path: str,
    *,
    recursive: bool = True,
    near_match: bool = True,
) -> list[DuplicateGroup]:
    """
    Detect exact and (optionally) near-duplicate images in *folder_path*.

    Returns a list of DuplicateGroup — one per cluster of duplicates.
    Only images are perceptual-hashed; videos are exact-match only.
    """
    media = scan_folder(folder_path, recursive=recursive, include_videos=True)

    # --- exact duplicates (all file types) ---
    exact_buckets: dict[str, list[MediaFile]] = defaultdict(list)
    for mf in media:
        digest = _sha256(Path(mf.path))
        exact_buckets[digest].append(mf)

    groups: list[DuplicateGroup] = []
    already_matched: set[str] = set()

    for digest, files in exact_buckets.items():
        if len(files) < 2:
            continue
        for f in files:
            already_matched.add(f.path)
        groups.append(
            DuplicateGroup(
                group_id=digest,
                match_type="exact",
                files=files,
                recommended_keep=_best_to_keep(files),
            )
        )

    if not near_match:
        return groups

    # --- near-duplicates (images only, excluding exact-match files) ---
    images = [
        mf for mf in media
        if mf.media_type == MediaType.image and mf.path not in already_matched
    ]

    hashed: list[tuple[MediaFile, imagehash.ImageHash]] = []
    for mf in images:
        ph = _phash(Path(mf.path))
        if ph is not None:
            hashed.append((mf, ph))

    visited: set[int] = set()
    for i, (mf_i, ph_i) in enumerate(hashed):
        if i in visited:
            continue
        cluster = [mf_i]
        for j, (mf_j, ph_j) in enumerate(hashed):
            if j <= i or j in visited:
                continue
            if (ph_i - ph_j) <= PHASH_THRESHOLD:
                cluster.append(mf_j)
                visited.add(j)
        if len(cluster) > 1:
            visited.add(i)
            groups.append(
                DuplicateGroup(
                    group_id=str(uuid.uuid4()),
                    match_type="near",
                    files=cluster,
                    recommended_keep=_best_to_keep(cluster),
                )
            )

    return groups
