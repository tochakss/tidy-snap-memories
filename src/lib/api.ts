const BASE = "http://localhost:8000";
const DUPES_BASE = "http://localhost:8000";

export interface MediaFile {
  path: string;
  filename: string;
  media_type: "image" | "video" | "unknown";
  size_bytes: number;
  modified_at: string;
  width?: number;
  height?: number;
  duration_seconds?: number;
  mime_type?: string;
}

export interface ScanResponse {
  folder_path: string;
  total_files: number;
  media: MediaFile[];
}

export interface DuplicateGroup {
  group_id: string;
  match_type: "exact" | "near";
  duplicate_type?: "exact" | "near"; // alias some backends send
  files: MediaFile[];
  recommended_keep?: string;
  potential_savings_bytes?: number;
}

export interface DuplicatesResponse {
  total_groups: number;
  wasted_bytes: number;
  groups: DuplicateGroup[];
}

export interface AlbumSuggestion {
  album_name: string;
  photo_count: number;
  date_range: string;
  location: string;
  lat?: number | null;
  lon?: number | null;
  photo_paths: string[];
}

export interface ExportResult {
  albums_created: number;
  photos_copied: number;
  skipped: number;
  output_path: string;
}

export interface ExportProgress {
  status: "idle" | "running" | "done" | "error";
  total: number;
  copied: number;
  skipped: number;
  current_file: string;
  error: string | null;
  result: ExportResult | null;
}

export interface SyncResult {
  new_photos_found: number;
  albums_updated: number;
  new_albums_created: number;
  preview: AlbumSuggestion[];
  confirmed: boolean;
}

export interface ScoredMedia {
  file_path: string;
  filename: string;
  thumbnail_url: string;
  sharpness: number;
  brightness: number;
  composite_score: number;
  memory_score: number; // 1-10
  ai_reason: string;
  keep_suggested: boolean;
  faces_detected: boolean;
}

export interface AIScanProgress {
  status: "idle" | "running" | "done" | "error";
  total: number;
  completed: number;
  results: ScoredMedia[];
  error: string | null;
}

export interface DeleteResult {
  deleted: number;
  freed_bytes: number;
  errors: string[];
}

export interface ScoreResult {
  path: string;
  blur_score: number;
  brightness_score: number;
  is_blurry: boolean;
  is_dark: boolean;
  overall_score: number;
}

export interface PublishResult {
  path: string;
  title: string;
  description: string;
  tags: string[];
  suggested_category?: string;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export function scanFolder(folderPath: string): Promise<ScanResponse> {
  return api<ScanResponse>(`${BASE}/api/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder_path: folderPath }),
  });
}

export function getDuplicates(folderPath: string): Promise<DuplicatesResponse> {
  return api<DuplicatesResponse>(
    `${DUPES_BASE}/api/duplicates?folder_path=${encodeURIComponent(folderPath)}`,
  );
}

export function deleteDuplicates(filePaths: string[]): Promise<DeleteResult> {
  return api<DeleteResult>(`${DUPES_BASE}/api/duplicates/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_paths: filePaths }),
  });
}

export function runAIScan(
  folderPath: string,
  provider: string = "ollama",
): Promise<{ status: string }> {
  return api(`${BASE}/api/scan/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder_path: folderPath, provider }),
  });
}

export function getAIProgress(): Promise<AIScanProgress> {
  return api<AIScanProgress>(`${BASE}/api/scan/ai/progress`);
}

export function generateAlbums(
  folderPath: string,
  options: { provider?: string; useAiNames?: boolean } = {},
): Promise<AlbumSuggestion[]> {
  return api<AlbumSuggestion[]>(`${BASE}/api/albums/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      folder_path: folderPath,
      provider: options.provider ?? "ollama",
      use_ai_names: options.useAiNames ?? false,
    }),
  });
}

export function exportAlbums(
  albums: AlbumSuggestion[],
  outputPath: string,
): Promise<{ status: string }> {
  return api(`${BASE}/api/albums/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ albums, output_path: outputPath }),
  });
}

export function getExportProgress(): Promise<ExportProgress> {
  return api<ExportProgress>(`${BASE}/api/albums/export/progress`);
}

export function syncAlbums(
  sourceFolder: string,
  organizedFolder: string,
  confirmed: boolean = false,
): Promise<SyncResult> {
  return api<SyncResult>(`${BASE}/api/albums/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_folder: sourceFolder, organized_folder: organizedFolder, confirmed }),
  });
}

export function openFolder(path: string): Promise<{ opened: string }> {
  return api(`${BASE}/api/albums/open-folder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
}

export function scoreFile(filePath: string): Promise<ScoreResult> {
  return api<ScoreResult>(`${BASE}/api/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paths: [filePath] }),
  });
}

export function publishVideo(filePath: string, context = ""): Promise<PublishResult> {
  return api<PublishResult>(`${BASE}/api/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: filePath, context }),
  });
}

/** Returns the backend URL that serves a local file as an image. */
export function fileUrl(path: string): string {
  return `${BASE}/api/file?path=${encodeURIComponent(path)}`;
}
