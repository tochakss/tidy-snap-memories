import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FolderOpen, MapPin, Image as ImageIcon, Calendar, X,
  Loader2, AlertCircle, Check, RefreshCw, ArrowUpRight, FolderSync,
} from "lucide-react";
import {
  generateAlbums, exportAlbums, getExportProgress, syncAlbums, openFolder,
  fileUrl,
  type AlbumSuggestion, type ExportProgress, type SyncResult,
} from "@/lib/api";

interface Props {
  folderPath: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function defaultOutputPath(folderPath: string): string {
  const parts = folderPath.split("/");
  parts.pop();
  return parts.join("/") + "/Organized";
}

// ── main component ────────────────────────────────────────────────────────────

export function AlbumsPanel({ folderPath }: Props) {
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  const { data: albums, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["albums", folderPath],
    queryFn: () => generateAlbums(folderPath),
    enabled: !!folderPath,
    staleTime: 5 * 60_000,
  });

  const realAlbums = albums?.filter((a) => a.album_name !== "Unsorted") ?? [];
  const unsorted = albums?.find((a) => a.album_name === "Unsorted");
  const hasGps = realAlbums.length > 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Grouping your memories by location…</p>
        <p className="text-xs text-muted-foreground/70">
          This may take a moment — we're reading GPS from every photo.
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium text-destructive">
          {error instanceof Error ? error.message : "Failed to generate albums"}
        </p>
        <button onClick={() => refetch()} className="rounded-lg border border-border px-4 py-2 text-xs font-medium hover:bg-accent">
          Retry
        </button>
      </div>
    );
  }

  if (!hasGps && !unsorted) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <MapPin className="h-10 w-10" strokeWidth={1.5} />
        <p className="text-sm font-medium">No GPS data found</p>
        <p className="text-xs text-center max-w-xs">
          Albums need location data in your photos' EXIF metadata. Photos taken
          on most smartphones include GPS automatically.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">
            {realAlbums.length} album{realAlbums.length !== 1 ? "s" : ""}
          </h2>
          {unsorted && (
            <span className="text-xs text-muted-foreground">
              · {unsorted.photo_count} unsorted
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
          <button
            onClick={() => setSyncModalOpen(true)}
            disabled={!albums?.length}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <FolderSync className="h-3 w-3" /> Sync new photos
          </button>
          <button
            onClick={() => setExportModalOpen(true)}
            disabled={!albums?.length}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow-soft transition-smooth hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
          >
            <FolderOpen className="h-3 w-3" /> Export to folders
          </button>
        </div>
      </div>

      {/* Album grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {realAlbums.map((album) => (
          <AlbumCard key={album.album_name} album={album} />
        ))}
        {unsorted && <AlbumCard album={unsorted} isUnsorted />}
      </div>

      {/* Modals */}
      {exportModalOpen && albums && (
        <ExportModal
          albums={albums}
          folderPath={folderPath}
          onClose={() => setExportModalOpen(false)}
        />
      )}
      {syncModalOpen && (
        <SyncModal
          folderPath={folderPath}
          onClose={() => setSyncModalOpen(false)}
        />
      )}
    </>
  );
}

// ── AlbumCard ─────────────────────────────────────────────────────────────────

function AlbumCard({ album, isUnsorted = false }: { album: AlbumSuggestion; isUnsorted?: boolean }) {
  const cover = album.photo_paths[0];
  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-gradient-card transition-smooth hover:border-border-strong hover:-translate-y-0.5 hover:shadow-elev">
      {/* Cover */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {cover ? (
          <img
            src={fileUrl(cover)}
            alt={album.album_name}
            loading="lazy"
            className="h-full w-full object-cover transition-smooth group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-2.5 left-2.5 font-mono text-[10px] font-semibold text-white/80">
          {album.photo_count} photo{album.photo_count !== 1 ? "s" : ""}
        </div>
        {isUnsorted && (
          <div className="absolute right-2.5 top-2.5 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-white/80 backdrop-blur-md">
            No GPS
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="truncate text-sm font-semibold" title={album.album_name}>
          {album.album_name}
        </div>
        {album.location && album.location !== "No GPS data" && (
          <div className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            {album.location}
          </div>
        )}
        {album.date_range && (
          <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
            <Calendar className="h-2.5 w-2.5 shrink-0" />
            {album.date_range}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ExportModal ───────────────────────────────────────────────────────────────

type ExportPhase = "preview" | "exporting" | "done";

function ExportModal({
  albums,
  folderPath,
  onClose,
}: {
  albums: AlbumSuggestion[];
  folderPath: string;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<ExportPhase>("preview");
  const [outputPath, setOutputPath] = useState(defaultOutputPath(folderPath));
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalPhotos = albums.reduce((acc, a) => acc + a.photo_count, 0);
  const realAlbums = albums.filter((a) => a.album_name !== "Unsorted");
  const previewNames = realAlbums.slice(0, 5).map((a) => a.album_name);

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
  }

  useEffect(() => () => stopPolling(), []);

  async function handleExport() {
    setPhase("exporting");
    try {
      await exportAlbums(albums, outputPath);
      pollRef.current = setInterval(async () => {
        const p = await getExportProgress();
        setProgress(p);
        if (p.status === "done" || p.status === "error") {
          stopPolling();
          setPhase("done");
        }
      }, 1500);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
      setPhase("preview");
    }
  }

  const pct =
    progress && progress.total > 0
      ? Math.round((progress.copied / progress.total) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="w-[480px] rounded-2xl border border-border bg-surface-elevated p-6 shadow-elev">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold">Export to folders</div>
              <div className="text-xs text-muted-foreground">
                {phase === "preview"
                  ? `${realAlbums.length} albums · ${totalPhotos} photos`
                  : phase === "exporting"
                    ? "Copying photos…"
                    : "Export complete"}
              </div>
            </div>
          </div>
          {phase !== "exporting" && (
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {phase === "preview" && (
          <>
            {/* Output path */}
            <div className="mt-5">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Output folder
              </label>
              <input
                value={outputPath}
                onChange={(e) => setOutputPath(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 font-mono text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                placeholder="/path/to/output"
              />
            </div>

            {/* Preview */}
            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3.5 text-xs">
              <div className="mb-2 font-semibold">
                Will create {realAlbums.length} folders, copy {totalPhotos} photos
              </div>
              <ul className="space-y-1 text-muted-foreground">
                {previewNames.map((n) => (
                  <li key={n} className="flex items-center gap-1.5">
                    <FolderOpen className="h-3 w-3 shrink-0" />
                    {n}/
                  </li>
                ))}
                {realAlbums.length > 5 && (
                  <li className="text-muted-foreground/60">
                    … and {realAlbums.length - 5} more
                  </li>
                )}
                {albums.some((a) => a.album_name === "Unsorted") && (
                  <li className="flex items-center gap-1.5">
                    <FolderOpen className="h-3 w-3 shrink-0" />
                    Unsorted/
                  </li>
                )}
              </ul>
            </div>

            {/* Safety note */}
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs text-muted-foreground">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Original photos are never moved or deleted — only copies are made.
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-smooth hover:bg-accent">
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={!outputPath.trim()}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow-soft transition-smooth hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              >
                Export
              </button>
            </div>
          </>
        )}

        {phase === "exporting" && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate font-medium">{progress?.current_file || "Starting…"}</div>
                <div className="text-xs text-muted-foreground">
                  {progress?.copied ?? 0} of {progress?.total ?? totalPhotos} copied
                </div>
              </div>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-primary transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {phase === "done" && progress?.result && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-4 w-4" strokeWidth={3} />
              </div>
              <div>
                <div className="font-semibold">
                  {progress.result.photos_copied} photos organised into {progress.result.albums_created} albums ✓
                </div>
                {progress.result.skipped > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {progress.result.skipped} already existed — skipped
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 font-mono text-xs text-muted-foreground">
              {progress.result.output_path}
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-smooth hover:bg-accent">
                Close
              </button>
              <button
                onClick={() => openFolder(progress.result!.output_path).catch(() => {})}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow-soft transition-smooth hover:scale-[1.02]"
              >
                Open in Finder <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SyncModal ─────────────────────────────────────────────────────────────────

type SyncPhase = "input" | "preview" | "syncing" | "done";

function SyncModal({
  folderPath,
  onClose,
}: {
  folderPath: string;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<SyncPhase>("input");
  const [organizedFolder, setOrganizedFolder] = useState(defaultOutputPath(folderPath));
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handlePreview() {
    setIsLoading(true);
    try {
      const result = await syncAlbums(folderPath, organizedFolder, false);
      setSyncResult(result);
      setPhase("preview");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm() {
    setPhase("syncing");
    try {
      const result = await syncAlbums(folderPath, organizedFolder, true);
      setSyncResult(result);
      setPhase("done");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Sync failed");
      setPhase("preview");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="w-[480px] rounded-2xl border border-border bg-surface-elevated p-6 shadow-elev">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
              <FolderSync className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold">Sync new photos</div>
              <div className="text-xs text-muted-foreground">Copy new photos into your organised folders</div>
            </div>
          </div>
          {phase !== "syncing" && (
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {phase === "input" && (
          <>
            <div className="mt-5">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Organised folder (destination)
              </label>
              <input
                value={organizedFolder}
                onChange={(e) => setOrganizedFolder(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 font-mono text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                placeholder="/path/to/Organized"
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              We'll scan your source folder for photos not already in this folder and show you a preview before copying anything.
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-smooth hover:bg-accent">Cancel</button>
              <button
                onClick={handlePreview}
                disabled={isLoading || !organizedFolder.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow-soft transition-smooth hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isLoading ? "Scanning…" : "Preview sync"}
              </button>
            </div>
          </>
        )}

        {phase === "preview" && syncResult && (
          <>
            <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
              {syncResult.new_photos_found === 0 ? (
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  All photos are already organised — nothing to sync.
                </div>
              ) : (
                <>
                  <div className="text-sm font-semibold">
                    {syncResult.new_photos_found} new photo{syncResult.new_photos_found !== 1 ? "s" : ""} found
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {syncResult.new_albums_created} new album{syncResult.new_albums_created !== 1 ? "s" : ""} will be created
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {syncResult.preview.slice(0, 5).map((a) => (
                      <li key={a.album_name} className="flex items-center gap-1.5">
                        <FolderOpen className="h-3 w-3 shrink-0" />
                        {a.album_name} ({a.photo_count} photos)
                      </li>
                    ))}
                    {syncResult.preview.length > 5 && (
                      <li className="text-muted-foreground/60">… and {syncResult.preview.length - 5} more</li>
                    )}
                  </ul>
                </>
              )}
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs text-muted-foreground">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Already-organised photos are never touched.
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setPhase("input")} className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-smooth hover:bg-accent">Back</button>
              {syncResult.new_photos_found > 0 && (
                <button
                  onClick={handleConfirm}
                  className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow-soft transition-smooth hover:scale-[1.02]"
                >
                  Confirm sync
                </button>
              )}
              {syncResult.new_photos_found === 0 && (
                <button onClick={onClose} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Close</button>
              )}
            </div>
          </>
        )}

        {phase === "syncing" && (
          <div className="mt-5 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm">Copying new photos…</p>
          </div>
        )}

        {phase === "done" && syncResult && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-4 w-4" strokeWidth={3} />
              </div>
              <div>
                <div className="font-semibold">
                  {syncResult.new_photos_found} photo{syncResult.new_photos_found !== 1 ? "s" : ""} synced ✓
                </div>
                <div className="text-xs text-muted-foreground">
                  {syncResult.new_albums_created} new album{syncResult.new_albums_created !== 1 ? "s" : ""} created
                </div>
              </div>
            </div>
            <button onClick={onClose} className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-smooth hover:bg-accent">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
