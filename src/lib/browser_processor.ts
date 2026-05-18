/**
 * Browser-mode processing pipeline — no backend required.
 *
 * Provides the same data shapes as the FastAPI backend so all existing UI
 * components work unchanged. Files never leave the browser.
 *
 * Capabilities:
 *   Scan        ✅ folder picker (Chrome/Edge) or file upload (Safari/Firefox)
 *   Duplicates  ✅ SHA-256 exact + perceptual-hash near-duplicate detection
 *   CV scoring  ✅ sharpness (pixel variance) + brightness via canvas
 *   AI scoring  ✗  requires Ollama / API key (show CV score instead)
 *   Albums      ✗  requires geocoding service
 *   Publish     ✗  requires backend OAuth
 */
import type {
  ScanResponse,
  MediaFile,
  DuplicatesResponse,
  DuplicateGroup,
  AIScanProgress,
  ScoredMedia,
  DeleteResult,
} from "./api";

// ── supported formats ──────────────────────────────────────────────────────────

const IMAGE_EXTS = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "tif",
  "heic", "heif", "avif",
]);
const VIDEO_EXTS = new Set(["mp4", "mov", "avi", "mkv", "wmv", "flv", "webm", "m4v"]);

function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function mediaTypeOf(name: string): "image" | "video" | "unknown" {
  const e = extOf(name);
  if (IMAGE_EXTS.has(e)) return "image";
  if (VIDEO_EXTS.has(e)) return "video";
  return "unknown";
}

// ── in-memory store ────────────────────────────────────────────────────────────

interface BrowserFile {
  path: string;   // synthetic: "FolderName/sub/file.jpg" or "browser/file.jpg"
  file: File;
  mediaType: "image" | "video" | "unknown";
}

let _store: BrowserFile[] = [];
let _objectUrls = new Map<string, string>();
let _scanResult: ScanResponse | null = null;
let _dupeResult: DuplicatesResponse | null = null;
let _aiProgress: AIScanProgress = {
  status: "idle", total: 0, completed: 0, results: [], error: null,
};

// ── public read helpers ────────────────────────────────────────────────────────

export function hasBrowserFiles(): boolean { return _store.length > 0; }
export function getBrowserScanResult(): ScanResponse | null { return _scanResult; }
export function getBrowserAIProgress(): AIScanProgress { return { ..._aiProgress, results: [..._aiProgress.results] }; }

export function getBrowserObjectUrl(path: string): string {
  if (_objectUrls.has(path)) return _objectUrls.get(path)!;
  const entry = _store.find((f) => f.path === path);
  if (!entry) return "";
  const url = URL.createObjectURL(entry.file);
  _objectUrls.set(path, url);
  return url;
}

// ── folder/file ingestion ──────────────────────────────────────────────────────

// FileSystemDirectoryHandle is not in all TS lib versions; cast via unknown.
type DirHandle = {
  name: string;
  kind: "directory";
  entries(): AsyncIterableIterator<[string, DirHandle | FileHandle]>;
};
type FileHandle = {
  kind: "file";
  getFile(): Promise<File>;
};

async function* _walkDir(
  dir: DirHandle,
  prefix: string,
): AsyncGenerator<BrowserFile> {
  for await (const [name, handle] of dir.entries()) {
    const path = `${prefix}/${name}`;
    if (handle.kind === "file") {
      const file = await (handle as FileHandle).getFile();
      const mt = mediaTypeOf(file.name);
      if (mt !== "unknown") yield { path, file, mediaType: mt };
    } else {
      yield* _walkDir(handle as DirHandle, path);
    }
  }
}

export async function browserScanFromDirectory(
  dirHandle: unknown,
  onProgress?: (done: number, total: number) => void,
): Promise<ScanResponse> {
  _reset();
  const handle = dirHandle as DirHandle;
  const all: BrowserFile[] = [];
  for await (const bf of _walkDir(handle, handle.name)) all.push(bf);
  return _finalize(all, onProgress);
}

export async function browserScanFromFiles(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<ScanResponse> {
  _reset();
  const filtered = files
    .filter((f) => mediaTypeOf(f.name) !== "unknown")
    .map<BrowserFile>((f) => ({ path: `browser/${f.name}`, file: f, mediaType: mediaTypeOf(f.name) }));
  return _finalize(filtered, onProgress);
}

function _reset() {
  _store = [];
  _objectUrls.clear();
  _scanResult = null;
  _dupeResult = null;
  _aiProgress = { status: "idle", total: 0, completed: 0, results: [], error: null };
}

async function _finalize(
  entries: BrowserFile[],
  onProgress?: (done: number, total: number) => void,
): Promise<ScanResponse> {
  _store = entries;
  const BATCH = 20;
  const media: MediaFile[] = [];

  for (let i = 0; i < entries.length; i += BATCH) {
    media.push(...entries.slice(i, i + BATCH).map(_toMediaFile));
    onProgress?.(Math.min(i + BATCH, entries.length), entries.length);
  }

  _scanResult = { folder_path: "__browser__", total_files: media.length, media };
  return _scanResult;
}

function _toMediaFile(bf: BrowserFile): MediaFile {
  return {
    path: bf.path,
    filename: bf.file.name,
    media_type: bf.mediaType === "image" ? "image" : bf.mediaType === "video" ? "video" : "unknown",
    size_bytes: bf.file.size,
    modified_at: new Date(bf.file.lastModified).toISOString(),
    mime_type: bf.file.type || undefined,
  };
}

// ── SHA-256 exact duplicate hash ───────────────────────────────────────────────

async function sha256(file: File): Promise<string> {
  // For large files hash head+tail to keep memory manageable
  let buf: ArrayBuffer;
  const CHUNK = 512 * 1024;
  if (file.size > 5 * 1024 * 1024) {
    const head = await file.slice(0, CHUNK).arrayBuffer();
    const tail = await file.slice(-CHUNK).arrayBuffer();
    const merged = new Uint8Array(head.byteLength + tail.byteLength);
    merged.set(new Uint8Array(head));
    merged.set(new Uint8Array(tail), head.byteLength);
    buf = merged.buffer;
  } else {
    buf = await file.arrayBuffer();
  }
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── perceptual hash (8×8 average hash) ────────────────────────────────────────

function _loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

async function pHash(file: File): Promise<bigint> {
  const url = URL.createObjectURL(file);
  try {
    const img = await _loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, 8, 8);
    const { data } = ctx.getImageData(0, 0, 8, 8);

    const grey: number[] = [];
    for (let i = 0; i < 64; i++) {
      grey.push(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
    }
    const avg = grey.reduce((a, b) => a + b, 0) / 64;
    let hash = 0n;
    for (let i = 0; i < 64; i++) {
      if (grey[i] >= avg) hash |= 1n << BigInt(i);
    }
    return hash;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}

// ── duplicate detection ────────────────────────────────────────────────────────

export async function browserGetDuplicates(
  onProgress?: (done: number, total: number) => void,
): Promise<DuplicatesResponse> {
  if (_dupeResult) return _dupeResult;
  if (_store.length === 0) return { total_groups: 0, wasted_bytes: 0, groups: [] };

  const images = _store.filter((f) => f.mediaType === "image");
  const total = images.length;
  let done = 0;
  let gi = 0;
  const groups: DuplicateGroup[] = [];

  // ── exact: group by size, then SHA-256 within same-size groups ─────────────
  const bySize = new Map<number, BrowserFile[]>();
  for (const bf of images) {
    const sz = bf.file.size;
    bySize.set(sz, [...(bySize.get(sz) ?? []), bf]);
  }

  const hashMap = new Map<string, BrowserFile[]>();
  for (const [, bucket] of bySize) {
    if (bucket.length < 2) {
      done += bucket.length;
      onProgress?.(done, total);
      continue;
    }
    for (const bf of bucket) {
      const h = await sha256(bf.file);
      hashMap.set(h, [...(hashMap.get(h) ?? []), bf]);
      done++;
      onProgress?.(done, total);
    }
  }

  const exactPaths = new Set<string>();
  for (const [, grp] of hashMap) {
    if (grp.length < 2) continue;
    const sorted = [...grp].sort((a, b) => b.file.size - a.file.size);
    const wasted = sorted.slice(1).reduce((acc, f) => acc + f.file.size, 0);
    groups.push({
      group_id: `browser-${gi++}`,
      match_type: "exact",
      files: sorted.map(_toMediaFile),
      recommended_keep: sorted[0].path,
      potential_savings_bytes: wasted,
    });
    sorted.forEach((f) => exactPaths.add(f.path));
  }

  // ── near: pHash comparison on images not already in an exact group ─────────
  const candidates = images.filter((f) => !exactPaths.has(f.path));
  const hashes: Array<{ bf: BrowserFile; hash: bigint }> = [];
  for (const bf of candidates) {
    try { hashes.push({ bf, hash: await pHash(bf.file) }); }
    catch { /* skip unrenderable files */ }
  }

  const used = new Set<string>();
  for (let i = 0; i < hashes.length; i++) {
    if (used.has(hashes[i].bf.path)) continue;
    const grp: BrowserFile[] = [hashes[i].bf];
    for (let j = i + 1; j < hashes.length; j++) {
      if (!used.has(hashes[j].bf.path) && hammingDistance(hashes[i].hash, hashes[j].hash) <= 10) {
        grp.push(hashes[j].bf);
        used.add(hashes[j].bf.path);
      }
    }
    if (grp.length > 1) {
      used.add(hashes[i].bf.path);
      const sorted = [...grp].sort((a, b) => b.file.size - a.file.size);
      const wasted = sorted.slice(1).reduce((acc, f) => acc + f.file.size, 0);
      groups.push({
        group_id: `browser-${gi++}`,
        match_type: "near",
        files: sorted.map(_toMediaFile),
        recommended_keep: sorted[0].path,
        potential_savings_bytes: wasted,
      });
    }
  }

  const wasted_bytes = groups.reduce((acc, g) => acc + (g.potential_savings_bytes ?? 0), 0);
  _dupeResult = { total_groups: groups.length, wasted_bytes, groups };
  return _dupeResult;
}

/** Browser mode cannot delete files — return informative error. */
export function browserDeleteDuplicates(_paths: string[]): DeleteResult {
  return {
    deleted: 0,
    freed_bytes: 0,
    errors: ["File deletion is not available in browser mode. Download the TidySnaps desktop app for full features."],
  };
}

// ── CV scoring ─────────────────────────────────────────────────────────────────

async function cvScore(file: File): Promise<{ sharpness: number; brightness: number; composite_score: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await _loadImage(url);
    const SIZE = 256;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

    const grey: number[] = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      grey.push(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
    }
    const brightness = grey.reduce((a, b) => a + b, 0) / grey.length;
    const variance = grey.reduce((acc, g) => acc + (g - brightness) ** 2, 0) / grey.length;
    const sharpness = Math.min(variance, 800);
    const composite_score = (sharpness / 800) * 60 + (brightness / 255) * 40;
    return { sharpness, brightness, composite_score };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Start background CV-only scoring. Poll getBrowserAIProgress() for results. */
export function browserStartAIScan(): void {
  if (_aiProgress.status === "running") return;
  _aiProgress = { status: "running", total: _store.length, completed: 0, results: [], error: null };

  const images = _store.filter((f) => f.mediaType === "image");
  _aiProgress.total = images.length;

  const BATCH = 20;
  (async () => {
    const accumulated: ScoredMedia[] = [];
    try {
      for (let i = 0; i < images.length; i += BATCH) {
        const batch = images.slice(i, i + BATCH);
        const scored = await Promise.all(
          batch.map(async (bf): Promise<ScoredMedia | null> => {
            try {
              const cv = await cvScore(bf.file);
              const memScore = Math.max(1, Math.min(10, Math.round(cv.composite_score / 10)));
              return {
                file_path: bf.path,
                filename: bf.file.name,
                thumbnail_url: getBrowserObjectUrl(bf.path),
                sharpness: cv.sharpness,
                brightness: cv.brightness,
                composite_score: cv.composite_score,
                memory_score: memScore,
                ai_reason: `CV — sharpness ${Math.round(cv.sharpness)}, brightness ${cv.brightness.toFixed(0)}`,
                keep_suggested: cv.composite_score >= 30,
                faces_detected: false,
              };
            } catch {
              return null;
            }
          }),
        );
        accumulated.push(...scored.filter((r): r is ScoredMedia => r !== null));
        _aiProgress = {
          ..._aiProgress,
          completed: Math.min(i + BATCH, images.length),
          results: [...accumulated],
        };
      }
      _aiProgress = { ..._aiProgress, status: "done", completed: images.length };
    } catch (err) {
      _aiProgress = { ..._aiProgress, status: "error", error: String(err) };
    }
  })();
}
