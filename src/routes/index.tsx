import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, ImageIcon, Copy, HardDrive, Brain, ArrowUpRight, Loader2, AlertCircle, X, Cpu } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PhotoCard } from "@/components/PhotoCard";
import { AlbumsPanel } from "@/components/AlbumsPanel";
import { type Photo } from "@/lib/photos";
import { scanFolder, getDuplicates, runAIScan, getScanResults, fileUrl, type MediaFile } from "@/lib/api";
import { getSettings, type Settings } from "@/lib/settings";
import { useModeDetecting } from "@/lib/mode";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Library — TidySnaps" },
      { name: "description", content: "Your full photo and video library, scored and organized by AI." },
    ],
  }),
  component: LibraryPage,
});

// ── helpers ──────────────────────────────────────────────────────────────────

type MediaTypeLabel = Photo["type"];

function toMediaTypeLabel(filename: string): MediaTypeLabel {
  const ext = filename.split(".").pop()?.toUpperCase() ?? "";
  const map: Record<string, MediaTypeLabel> = {
    HEIC: "HEIC", HEIF: "HEIC",
    JPG: "JPG", JPEG: "JPG",
    PNG: "PNG",
    MP4: "MP4",
    MOV: "MOV",
  };
  return map[ext] ?? "JPG";
}

function toAspect(width?: number, height?: number): Photo["aspect"] {
  if (!width || !height) return "square";
  const r = width / height;
  if (r > 1.2) return "wide";
  if (r < 0.8) return "tall";
  return "square";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function mediaFileToPhoto(mf: MediaFile): Photo {
  return {
    id: mf.path,
    src: fileUrl(mf.path),
    filename: mf.filename,
    type: toMediaTypeLabel(mf.filename),
    score: 5,
    size: formatBytes(mf.size_bytes),
    date: formatDate(mf.modified_at),
    aspect: toAspect(mf.width, mf.height),
  };
}

function formatTotalSize(bytes: number): string {
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ── component ─────────────────────────────────────────────────────────────────

type Filter = "all" | "photos" | "videos" | "albums";

type Provider = "ollama" | "claude" | "deepseek" | "grok";
type AiPhase = "select" | "running";

function LibraryPage() {
  const navigate = useNavigate();
  const detecting = useModeDetecting();
  const [settings, setSettings] = useState<Settings>({ name: "", folderPath: "" });
  const [filter, setFilter] = useState<Filter>("all");
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPhase, setAiPhase] = useState<AiPhase>("select");
  const [aiProvider, setAiProvider] = useState<Provider>("ollama");
  const [acceptanceRate, setAcceptanceRate] = useState<number | null>(null);

  useEffect(() => {
    setSettings(getSettings());
    const raw = typeof window !== "undefined" ? localStorage.getItem("ai_acceptance_rate") : null;
    if (raw !== null) setAcceptanceRate(parseInt(raw, 10));
  }, []);

  async function handleStartAiScan() {
    if (!settings.folderPath) return;
    setAiPhase("running");
    try {
      await runAIScan(settings.folderPath, aiProvider);
      const verified = await getScanResults();
      console.log("Verified results:", verified.length);
      setAiModalOpen(false);
      setAiPhase("select");
      navigate({ to: "/curation" });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start AI scan");
      setAiPhase("select");
    }
  }

  const firstName = settings.name.split(" ")[0] || "there";

  const queryEnabled = !!settings.folderPath && !detecting;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["scan", settings.folderPath],
    queryFn: () => scanFolder(settings.folderPath),
    enabled: queryEnabled,
  });

  // Same key as Sidebar + Duplicates page — served from cache, no extra fetch.
  const { data: dupData } = useQuery({
    queryKey: ["duplicates", settings.folderPath],
    queryFn: () => getDuplicates(settings.folderPath),
    enabled: queryEnabled,
  });

  const allMedia = data?.media ?? [];
  const filteredMedia = allMedia.filter((m) => {
    if (filter === "photos") return m.media_type === "image";
    if (filter === "videos") return m.media_type === "video";
    return true;
  });
  const photos = filteredMedia.map(mediaFileToPhoto);
  const totalFiles = data?.total_files ?? 0;
  const imageCount = allMedia.filter((m) => m.media_type === "image").length;
  const videoCount = allMedia.filter((m) => m.media_type === "video").length;
  const totalBytes = allMedia.reduce((acc, m) => acc + m.size_bytes, 0);

  const dupFileCount = dupData?.groups.reduce((acc, g) => acc + Math.max(0, g.files.length - 1), 0) ?? null;
  const dupWastedBytes = dupData?.wasted_bytes ?? null;

  const stats = [
    {
      label: "Total Assets",
      value: totalFiles.toLocaleString(),
      sub: `${imageCount.toLocaleString()} photos · ${videoCount.toLocaleString()} videos`,
      icon: ImageIcon,
      accent: false,
    },
    {
      label: "Duplicates Found",
      value: dupFileCount !== null ? dupFileCount.toLocaleString() : "—",
      sub: dupFileCount !== null && dupWastedBytes !== null
        ? `${formatBytes(dupWastedBytes)} recoverable`
        : "run duplicate scan",
      icon: Copy,
      accent: false,
    },
    {
      label: "Library Size",
      value: totalBytes ? formatTotalSize(totalBytes) : "—",
      sub: "total on disk",
      icon: HardDrive,
      accent: true,
    },
    {
      label: "AI Acceptance Rate",
      value: acceptanceRate !== null ? `${acceptanceRate}%` : "—",
      sub: acceptanceRate !== null ? "AI curation complete" : "run AI curation",
      icon: Brain,
      accent: false,
    },
  ];

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Library</div>
          <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight text-balance md:text-[34px]">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isLoading
              ? "Scanning your library…"
              : data
                ? `${totalFiles.toLocaleString()} memories indexed · ${settings.folderPath}`
                : settings.folderPath
                  ? "Set a folder path in Settings to start scanning."
                  : "Open Settings to choose your media folder."}
          </p>
        </div>
        <button
          onClick={() => setAiModalOpen(true)}
          disabled={!settings.folderPath}
          className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-smooth hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 md:w-auto"
        >
          <Sparkles className="h-4 w-4" strokeWidth={2.5} />
          Run AI Scan
          <ArrowUpRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:mt-8 md:grid-cols-4 md:gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-5 transition-smooth hover:border-border-strong"
            >
              {s.accent && (
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
              )}
              <div className="relative flex items-start justify-between">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                </div>
              </div>
              <div className="relative mt-3 text-3xl font-bold tracking-tight tabular-nums">
                {s.value}
              </div>
              <div className="relative mt-1 text-xs text-muted-foreground">{s.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Section title + filter tabs */}
      <div className="mt-10 mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {filter === "albums"
              ? "Albums"
              : filter === "all"
                ? "All memories"
                : filter === "photos"
                  ? "Photos"
                  : "Videos"}
            {filter !== "albums" && photos.length > 0 && (
              <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
                {photos.length.toLocaleString()}
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground">
            {filter === "albums"
              ? "Grouped by GPS location and date"
              : "Sorted by date · most recent first"}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1 text-xs">
          {(["all", "photos", "videos", "albums"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                filter === f
                  ? "rounded-md bg-accent px-3 py-1.5 font-medium"
                  : "rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
              }
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Albums tab */}
      {filter === "albums" && settings.folderPath && (
        <AlbumsPanel folderPath={settings.folderPath} />
      )}
      {filter === "albums" && !settings.folderPath && (
        <div className="flex flex-col items-center gap-2 py-24 text-muted-foreground">
          <p className="text-sm">Open Settings to choose a media folder first.</p>
        </div>
      )}

      {/* States */}
      {filter !== "albums" && isLoading && (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Scanning your library…</p>
        </div>
      )}

      {filter !== "albums" && isError && (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium text-destructive">
            {error instanceof Error ? error.message : "Scan failed"}
          </p>
          <button
            onClick={() => refetch()}
            className="rounded-lg border border-border px-4 py-2 text-xs font-medium hover:bg-accent"
          >
            Retry
          </button>
        </div>
      )}

      {filter !== "albums" && !isLoading && !isError && !settings.folderPath && (
        <div className="flex flex-col items-center gap-2 py-24 text-muted-foreground">
          <p className="text-sm">No folder selected — click the gear icon to open Settings.</p>
        </div>
      )}

      {/* Masonry grid */}
      {filter !== "albums" && !isLoading && !isError && photos.length > 0 && (
        <div className="columns-2 gap-3 md:columns-3 lg:columns-4 xl:columns-5">
          {photos.map((p, i) => (
            <div key={`${p.id}-${i}`} className="mb-4 break-inside-avoid">
              <PhotoCard photo={p} />
            </div>
          ))}
        </div>
      )}

      {filter !== "albums" && !isLoading && !isError && settings.folderPath && photos.length === 0 && data && (
        <div className="flex flex-col items-center gap-2 py-24 text-muted-foreground">
          <p className="text-sm">No media files found in {settings.folderPath}.</p>
        </div>
      )}

      {/* AI Scan Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-md sm:items-center">
          <div className="w-full rounded-t-2xl border border-border bg-surface-elevated p-6 shadow-elev sm:w-[440px] sm:rounded-2xl">
            {aiPhase === "select" ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold">Run AI Scan</div>
                      <div className="text-xs text-muted-foreground">Score every photo and video in your library</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setAiModalOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-5">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    AI Provider
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {(
                      [
                        { id: "ollama", label: "Ollama", sub: "local · free" },
                        { id: "deepseek", label: "DeepSeek", sub: "cheapest cloud · BYOK" },
                        { id: "claude", label: "Claude", sub: "Anthropic · BYOK" },
                        { id: "grok", label: "Grok", sub: "xAI · BYOK" },
                      ] as { id: Provider; label: string; sub: string }[]
                    ).map(({ id, label, sub }) => (
                      <button
                        key={id}
                        onClick={() => setAiProvider(id)}
                        className={`flex flex-1 flex-col items-center rounded-xl border px-3 py-2.5 text-xs transition-smooth ${
                          aiProvider === id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-surface text-muted-foreground hover:bg-accent/50"
                        }`}
                      >
                        <Cpu className="mb-1 h-4 w-4" />
                        <span className="font-semibold">{label}</span>
                        <span className="text-[10px] opacity-70">{sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                  This will score <strong className="text-foreground">{totalFiles.toLocaleString()} files</strong> — may take a few minutes.
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setAiModalOpen(false)}
                    className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-smooth hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartAiScan}
                    className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow-soft transition-smooth hover:scale-[1.02]"
                  >
                    Start Scan
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold">Scoring your library…</div>
                    <div className="text-xs text-muted-foreground">
                      Using {
                      aiProvider === "ollama" ? "Ollama (local)"
                      : aiProvider === "deepseek" ? "DeepSeek"
                      : aiProvider === "claude" ? "Claude"
                      : "Grok"
                    }
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="text-muted-foreground">Scoring photos…</span>
                    <span className="font-mono tabular-nums text-muted-foreground">running</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full w-full rounded-full bg-gradient-primary animate-pulse" />
                  </div>
                </div>

                <p className="mt-4 text-center text-xs text-muted-foreground">
                  You'll be taken to the Curation screen when complete.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
