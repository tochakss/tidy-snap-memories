import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Sparkles, X, Check, Trash2, Image as ImageIcon, Film,
  Brain, AlertCircle, Zap, Eye, EyeOff,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MemoryScore } from "@/components/MemoryScore";
import { getScanResults, type ScoredMedia } from "@/lib/api";

export const Route = createFileRoute("/curation")({
  head: () => ({
    meta: [
      { title: "AI Curation — TidySnaps" },
      { name: "description", content: "AI-curated highlights and Memory Score breakdown for every photo." },
    ],
  }),
  component: CurationPage,
});

// ── types ──────────────────────────────────────────────────────────────────────

type Decision = "keep" | "delete";
type MediaFilter = "all" | "photos" | "videos";
type ShowFilter = "all" | "keep" | "delete";

// ── helpers ───────────────────────────────────────────────────────────────────

function mediaTypeOf(filename: string): "photos" | "videos" {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "mov", "avi", "mkv", "wmv", "flv", "webm", "m4v"].includes(ext)
    ? "videos"
    : "photos";
}

function formatBrightness(b: number): string {
  if (b < 40) return "Dark";
  if (b > 220) return "Overexposed";
  return "Good";
}

function sharpnessPct(s: number): number {
  return Math.min(100, Math.round((s / 800) * 100));
}

function calcAcceptanceRate(
  results: ScoredMedia[],
  decisions: Record<string, Decision>,
): number | null {
  const entries = Object.entries(decisions);
  if (entries.length === 0) return null;
  const matches = entries.filter(([path, decision]) => {
    const r = results.find((x) => x.file_path === path);
    if (!r) return false;
    return (decision === "keep" && r.keep_suggested) ||
           (decision === "delete" && !r.keep_suggested);
  }).length;
  return Math.round((matches / entries.length) * 100);
}

// ── page ──────────────────────────────────────────────────────────────────────

function CurationPage() {
  const navigate = useNavigate();

  const [results, setResults] = useState<ScoredMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [selected, setSelected] = useState<ScoredMedia | null>(null);
  const [minScore, setMinScore] = useState(1);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [showFilter, setShowFilter] = useState<ShowFilter>("all");

  // Fetch results directly from the backend on every page load
  useEffect(() => {
    getScanResults()
      .then((data) => {
        console.log("Curation results:", data.length);
        const sorted = [...data].sort((a, b) => b.memory_score - a.memory_score);
        setResults(sorted);
        if (sorted[0]) setSelected(sorted[0]);
      })
      .catch((err) => console.error("Failed to load scan results:", err))
      .finally(() => setLoading(false));

    const savedDecisions = typeof window !== "undefined" ? localStorage.getItem("ai_decisions") : null;
    if (savedDecisions) {
      try { setDecisions(JSON.parse(savedDecisions)); } catch { /* ignore */ }
    }
  }, []);

  // Persist decisions + acceptance rate whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("ai_decisions", JSON.stringify(decisions));
    const rate = calcAcceptanceRate(results, decisions);
    if (rate !== null) {
      localStorage.setItem("ai_acceptance_rate", String(rate));
    }
  }, [decisions, results]);

  function decide(filePath: string, choice: Decision) {
    setDecisions((prev) => ({ ...prev, [filePath]: choice }));
  }

  const sorted = [...results].sort((a, b) => b.memory_score - a.memory_score);

  const filtered = sorted.filter((r) => {
    if (r.memory_score < minScore) return false;
    if (mediaFilter !== "all" && mediaTypeOf(r.filename) !== mediaFilter) return false;
    if (showFilter === "keep") return r.keep_suggested;
    if (showFilter === "delete") return !r.keep_suggested;
    return true;
  });

  const highlights = sorted.slice(0, 5);
  const totalDecisions = Object.keys(decisions).length;
  const acceptanceRate = calcAcceptanceRate(results, decisions);

  // ── empty state ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <AppShell>
        <div className="mt-20 flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <p className="text-sm">Loading scan results…</p>
        </div>
      </AppShell>
    );
  }

  if (results.length === 0) {
    return (
      <AppShell>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">AI Curation</div>
          <h1 className="mt-2 text-[34px] font-bold leading-tight tracking-tight">
            The best of your year, automatically.
          </h1>
        </div>
        <div className="mt-20 flex flex-col items-center gap-4 py-16 text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Brain className="h-8 w-8 text-primary" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-foreground">No scan results yet</p>
            <p className="mt-1 text-sm">
              Click <span className="font-medium text-foreground">Run AI Scan</span> on the Library page to score your photos.
            </p>
          </div>
          <button
            onClick={() => navigate({ to: "/" })}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-smooth hover:scale-[1.02]"
          >
            <Sparkles className="h-4 w-4" />
            Go to Library
          </button>
        </div>
      </AppShell>
    );
  }

  // ── main view ────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">AI Curation</div>
          <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight md:text-[34px]">
            The best of your year, automatically.
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {results.length.toLocaleString()} memories scored ·{" "}
            {acceptanceRate !== null
              ? `${acceptanceRate}% acceptance rate (${totalDecisions} reviewed)`
              : "click a photo to review"}
          </p>
        </div>
      </div>

      {/* Highlights carousel */}
      {highlights.length > 0 && (
        <div className="mt-8 rounded-3xl border border-border bg-gradient-card p-6">
          <div className="mb-4 flex items-end justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold tracking-tight">Top picks</h2>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {highlights.length} highest-scored · curated
              </span>
            </div>
          </div>
          {/* Mobile: horizontal scroll; desktop: 5-col feature grid */}
          <div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-5 md:overflow-visible md:pb-0">
            {highlights.map((r, i) => (
              <div
                key={r.file_path}
                className={`min-w-[140px] shrink-0 md:min-w-0 md:shrink ${i === 0 ? "min-w-[180px] md:col-span-2 md:row-span-2" : ""}`}
              >
                <HighlightCard
                  media={r}
                  decision={decisions[r.file_path]}
                  selected={selected?.file_path === r.file_path}
                  onClick={() => setSelected(r)}
                  aspectClass="aspect-square"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Layout: filters + grid + side panel */}
      <div className="mt-6 flex flex-col gap-6 md:mt-8 md:grid md:grid-cols-[200px_1fr_320px]">
        {/* Filter panel — hidden on mobile to save space */}
        <aside className="hidden space-y-5 md:block">
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Min Memory Score
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span>1</span>
                <span className="font-semibold text-primary">{minScore}+</span>
                <span>10</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="mt-2 w-full accent-primary"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Media type
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-1 text-xs">
              {(["all", "photos", "videos"] as MediaFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setMediaFilter(f)}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-smooth ${
                    mediaFilter === f
                      ? "bg-accent font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  {f === "photos" ? (
                    <ImageIcon className="h-3 w-3" />
                  ) : f === "videos" ? (
                    <Film className="h-3 w-3" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Show
            </div>
            <div className="space-y-1 text-xs">
              {(
                [
                  { value: "all", label: "All photos" },
                  { value: "keep", label: "Keep candidates" },
                  { value: "delete", label: "Delete candidates" },
                ] as { value: ShowFilter; label: string }[]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setShowFilter(value)}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-smooth hover:bg-accent/50 ${
                    showFilter === value ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                      showFilter === value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border-strong"
                    }`}
                  >
                    {showFilter === value && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          {totalDecisions > 0 && (
            <div className="rounded-xl border border-border bg-gradient-card p-3.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Review progress
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold tabular-nums text-primary">
                  {acceptanceRate ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">% acceptance</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-primary transition-all duration-500"
                  style={{ width: `${Math.round((totalDecisions / results.length) * 100)}%` }}
                />
              </div>
              <div className="mt-1.5 text-[10px] text-muted-foreground">
                {totalDecisions} of {results.length} reviewed
              </div>
            </div>
          )}
        </aside>

        {/* Photo grid */}
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Library by Memory Score</h3>
            <span className="text-[11px] text-muted-foreground">
              {filtered.length.toLocaleString()} items
            </span>
          </div>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm">No photos match the current filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {filtered.map((r) => (
                <GridCard
                  key={r.file_path}
                  media={r}
                  decision={decisions[r.file_path]}
                  selected={selected?.file_path === r.file_path}
                  onClick={() => setSelected(r)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <DetailPanel
            media={selected}
            decision={decisions[selected.file_path]}
            onKeep={() => decide(selected.file_path, "keep")}
            onDelete={() => decide(selected.file_path, "delete")}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </AppShell>
  );
}

// ── HighlightCard ─────────────────────────────────────────────────────────────

interface CardProps {
  media: ScoredMedia;
  decision?: Decision;
  selected: boolean;
  onClick: () => void;
  aspectClass?: string;
}

function HighlightCard({ media, decision, selected, onClick, aspectClass = "aspect-square" }: CardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative block w-full overflow-hidden rounded-2xl border bg-card text-left transition-smooth hover:-translate-y-0.5 hover:shadow-elev ${aspectClass} ${
        selected ? "border-primary shadow-glow-soft" : "border-border"
      }`}
    >
      <img
        src={media.thumbnail_url}
        alt={media.filename}
        loading="lazy"
        className="h-full w-full object-cover transition-smooth group-hover:scale-[1.04]"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
        <MemoryScore score={media.memory_score} size="sm" />
        {decision && (
          <span
            className={`inline-flex h-5 items-center justify-center rounded-full px-1.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
              decision === "keep"
                ? "bg-primary text-primary-foreground"
                : "bg-destructive text-destructive-foreground"
            }`}
          >
            {decision === "keep" ? "✓" : "✕"}
          </span>
        )}
      </div>
    </button>
  );
}

// ── GridCard ──────────────────────────────────────────────────────────────────

function GridCard({ media, decision, selected, onClick }: CardProps) {
  return (
    <div
      className={`relative ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-2xl" : ""}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`group relative block w-full aspect-square overflow-hidden rounded-2xl border bg-card text-left transition-smooth hover:-translate-y-0.5 hover:shadow-elev ${
          decision === "keep"
            ? "border-primary/60"
            : decision === "delete"
              ? "border-destructive/50 opacity-70"
              : "border-border"
        }`}
      >
        <img
          src={media.thumbnail_url}
          alt={media.filename}
          loading="lazy"
          className="h-full w-full object-cover transition-smooth group-hover:scale-[1.04]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 transition-smooth group-hover:opacity-100" />
        <div className="absolute bottom-2 left-2 flex items-center gap-1">
          <MemoryScore score={media.memory_score} size="sm" />
        </div>
        {decision === "keep" && (
          <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow-glow-soft">
            <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />
          </div>
        )}
        {decision === "delete" && (
          <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive">
            <Trash2 className="h-3 w-3 text-destructive-foreground" strokeWidth={2.5} />
          </div>
        )}
        {!decision && media.keep_suggested && (
          <div className="absolute right-2 top-2">
            <span className="rounded-md bg-black/50 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur-md">
              AI ★
            </span>
          </div>
        )}
      </button>
    </div>
  );
}

// ── DetailPanel ───────────────────────────────────────────────────────────────

interface DetailPanelProps {
  media: ScoredMedia;
  decision?: Decision;
  onKeep: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function DetailPanel({ media, decision, onKeep, onDelete, onClose }: DetailPanelProps) {
  const sharpPct = sharpnessPct(media.sharpness);
  const brightLabel = formatBrightness(media.brightness);

  return (
    <aside className="fixed inset-0 z-50 overflow-y-auto bg-surface-elevated animate-slide-up md:static md:sticky md:top-6 md:h-fit md:overflow-hidden md:rounded-2xl md:border md:border-border md:animate-slide-in-right">
      <div className="relative aspect-[4/3] md:aspect-[4/3]">
        <img
          src={media.thumbnail_url}
          alt={media.filename}
          className="h-full w-full object-cover"
        />
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-smooth hover:bg-black/80"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <MemoryScore score={media.memory_score} size="lg" />
          {media.faces_detected && (
            <span className="rounded-md bg-black/60 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-md">
              Faces ✓
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <div className="truncate font-mono text-[11px] font-medium text-muted-foreground">
            {media.filename}
          </div>
          <div className="mt-0.5 text-sm font-semibold">
            AI Recommendation: {media.keep_suggested ? "Keep" : "Delete"}
          </div>
        </div>

        {/* CV score breakdown */}
        <div>
          <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Quality metrics
          </div>
          <div className="space-y-2">
            <ScoreBar label="Memory Score" value={media.memory_score * 10} display={`${media.memory_score}/10`} />
            <ScoreBar label="Sharpness" value={sharpPct} display={`${sharpPct}%`} />
            <ScoreBar label="Brightness" value={Math.round((media.brightness / 255) * 100)} display={brightLabel} />
            <ScoreBar label="Composite" value={media.composite_score} display={`${media.composite_score.toFixed(0)}/100`} />
          </div>
        </div>

        {/* AI reasoning */}
        <div className="relative rounded-xl border-l-2 border-primary bg-card p-3.5">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-primary" />
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-primary">AI Analysis</span>
          </div>
          <p className="text-xs leading-relaxed text-foreground/90">
            {media.ai_reason || "No analysis available."}
          </p>
        </div>

        {/* Keep / Delete buttons — 48px min height for touch */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onKeep}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-3 text-sm font-semibold transition-smooth hover:scale-[1.02] min-h-[48px] md:py-2.5 md:text-xs md:min-h-0 ${
              decision === "keep"
                ? "bg-primary text-primary-foreground shadow-glow-soft"
                : "border border-border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Check className="h-4 w-4 md:h-3.5 md:w-3.5" strokeWidth={3} />
            {decision === "keep" ? "Kept ✓" : "Keep"}
          </button>
          <button
            onClick={onDelete}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-3 text-sm font-semibold transition-smooth hover:scale-[1.02] min-h-[48px] md:py-2.5 md:text-xs md:min-h-0 ${
              decision === "delete"
                ? "bg-destructive text-destructive-foreground"
                : "border border-border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
            {decision === "delete" ? "Deleted ✓" : "Delete"}
          </button>
        </div>

        {decision && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            {(decision === "keep") === media.keep_suggested ? (
              <><Eye className="h-3 w-3" /> Matches AI suggestion</>
            ) : (
              <><EyeOff className="h-3 w-3" /> Override of AI suggestion</>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

// ── ScoreBar ──────────────────────────────────────────────────────────────────

function ScoreBar({ label, value, display }: { label: string; value: number; display: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-medium">{label}</span>
        <span className="font-mono tabular-nums text-muted-foreground">{display}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-primary transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
