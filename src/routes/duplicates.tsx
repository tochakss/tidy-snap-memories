import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Trash2, Eye, SkipForward, Loader2, AlertCircle, X, Wand2, Copy, Layers, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { MemoryScore } from "@/components/MemoryScore";
import { getDuplicates, deleteDuplicates, fileUrl, type DuplicateGroup, type MediaFile } from "@/lib/api";
import { getSettings } from "@/lib/settings";

export const Route = createFileRoute("/duplicates")({
  head: () => ({
    meta: [
      { title: "Duplicates — TidySnaps" },
      { name: "description", content: "Review and remove duplicate photos and videos to recover storage." },
    ],
  }),
  component: DuplicatesPage,
});

// ── helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function matchLabel(group: DuplicateGroup): string {
  const type = group.match_type ?? group.duplicate_type ?? "near";
  return type === "exact" ? "exact copies" : "near-identical shots";
}

function savingsForGroup(group: DuplicateGroup): number {
  if (group.potential_savings_bytes != null) return group.potential_savings_bytes;
  const sorted = [...group.files].sort((a, b) => b.size_bytes - a.size_bytes);
  return sorted.slice(1).reduce((acc, f) => acc + f.size_bytes, 0);
}

/** Returns the paths of files to delete, honouring a manual keep selection if provided. */
function pathsToDelete(group: DuplicateGroup, keepOverride?: string): string[] {
  const keep = keepOverride ?? group.recommended_keep;
  return group.files.filter((f) => f.path !== keep).map((f) => f.path);
}

// ── page ─────────────────────────────────────────────────────────────────────

interface Toast {
  deleted: number;
  freed_bytes: number;
}

interface InfoToast {
  message: string;
}

function DuplicatesPage() {
  const [folderPath, setFolderPath] = useState("");
  /** group_ids the user has reviewed (Keep best / Review all) */
  const [kept, setKept] = useState<Set<string>>(new Set());
  /** group_ids removed from the UI after a successful delete */
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  /** manual keep selections: group_id → file path the user clicked to keep */
  const [userSelections, setUserSelections] = useState<Record<string, string>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [infoToast, setInfoToast] = useState<InfoToast | null>(null);

  useEffect(() => {
    setFolderPath(getSettings().folderPath);
  }, []);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["duplicates", folderPath],
    queryFn: () => getDuplicates(folderPath),
    enabled: !!folderPath,
  });

  const allGroups = data?.groups ?? [];
  const visibleGroups = allGroups.filter((g) => !dismissedIds.has(g.group_id));
  const totalGroups = visibleGroups.length;
  const wastedBytes = visibleGroups.reduce((acc, g) => acc + savingsForGroup(g), 0);
  const duplicateFileCount = visibleGroups.reduce((acc, g) => acc + Math.max(0, g.files.length - 1), 0);

  const reviewedCount = [...kept].filter((id) => !dismissedIds.has(id)).length;
  const pct = totalGroups > 0 ? Math.round((reviewedCount / totalGroups) * 100) : 0;

  const selectedSavings = [...kept]
    .filter((id) => !dismissedIds.has(id))
    .reduce((acc, id) => {
      const g = visibleGroups.find((g) => g.group_id === id);
      return acc + (g ? savingsForGroup(g) : 0);
    }, 0);

  function handleSelectKeep(groupId: string, filePath: string) {
    setUserSelections((prev) => ({ ...prev, [groupId]: filePath }));
    // clicking a card implicitly marks the group as reviewed
    setKept((prev) => new Set([...prev, groupId]));
  }

  function toggleKept(groupId: string) {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function showInfoToast(message: string) {
    setInfoToast({ message });
    setTimeout(() => setInfoToast(null), 4000);
  }

  function bulkSelectAll() {
    const ids = new Set(visibleGroups.map((g) => g.group_id));
    setKept(ids);
    showInfoToast(`Auto-selected best photo from ${ids.size} group${ids.size !== 1 ? "s" : ""}`);
  }

  function bulkSelectExact() {
    const exact = visibleGroups.filter(
      (g) => (g.match_type ?? g.duplicate_type ?? "near") === "exact",
    );
    setKept((prev) => {
      const next = new Set(prev);
      exact.forEach((g) => next.add(g.group_id));
      return next;
    });
    showInfoToast(
      exact.length > 0
        ? `Selected ${exact.length} exact duplicate group${exact.length !== 1 ? "s" : ""} — safe to delete`
        : "No exact duplicate groups found",
    );
  }

  function bulkSelectNear() {
    const near = visibleGroups.filter(
      (g) => (g.match_type ?? g.duplicate_type ?? "near") === "near",
    );
    setKept((prev) => {
      const next = new Set(prev);
      near.forEach((g) => next.add(g.group_id));
      return next;
    });
    showInfoToast(
      near.length > 0
        ? `Selected ${near.length} near-duplicate group${near.length !== 1 ? "s" : ""} — review before deleting`
        : "No near-duplicate groups found",
    );
  }

  function bulkClear() {
    setKept(new Set());
    showInfoToast("All selections cleared");
  }

  async function handleDelete() {
    const activeKept = [...kept].filter((id) => !dismissedIds.has(id));
    const filePaths = activeKept.flatMap((id) => {
      const g = visibleGroups.find((g) => g.group_id === id);
      return g ? pathsToDelete(g, userSelections[id]) : [];
    });

    if (filePaths.length === 0) return;

    setIsDeleting(true);
    try {
      const result = await deleteDuplicates(filePaths);
      // hide the now-deleted groups from the list
      setDismissedIds((prev) => new Set([...prev, ...activeKept]));
      setKept(new Set());
      setUserSelections((prev) => {
        const next = { ...prev };
        activeKept.forEach((id) => delete next[id]);
        return next;
      });
      setToast({ deleted: result.deleted, freed_bytes: result.freed_bytes });
      // auto-dismiss toast after 6 s
      setTimeout(() => setToast(null), 6000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  }

  const activeKeptCount = kept.size;

  return (
    <AppShell>
      {/* Header */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Duplicates</div>
        <h1 className="mt-2 text-2xl font-bold leading-tight tracking-tight md:text-[34px]">
          {isLoading
            ? "Scanning for duplicates…"
            : totalGroups > 0
              ? `${duplicateFileCount.toLocaleString()} duplicate${duplicateFileCount !== 1 ? "s" : ""} found`
              : "No duplicates found"}
          {!isLoading && wastedBytes > 0 && (
            <span className="ml-3 text-muted-foreground">· {formatBytes(wastedBytes)} recoverable</span>
          )}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {totalGroups > 0
            ? "We grouped near-identical shots so you can keep the best frame and free up space."
            : isLoading
              ? "Analysing your library…"
              : folderPath
                ? "Your library is clean — no duplicate groups detected."
                : "Open Settings to choose a media folder."}
        </p>
      </div>

      {/* Bulk actions toolbar */}
      {!isLoading && !isError && totalGroups > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-gradient-card px-4 py-3">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Bulk Actions
          </span>

          <button
            onClick={bulkSelectAll}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow-soft transition-smooth hover:scale-[1.02]"
          >
            <Wand2 className="h-3 w-3" />
            Auto-select all best
          </button>

          <button
            onClick={bulkSelectExact}
            className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition-smooth hover:bg-destructive/15"
          >
            <Copy className="h-3 w-3" />
            Select exact duplicates
          </button>

          <button
            onClick={bulkSelectNear}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
          >
            <Layers className="h-3 w-3" />
            Select near-duplicates
          </button>

          {activeKeptCount > 0 && (
            <button
              onClick={bulkClear}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              Clear all selections
            </button>
          )}
        </div>
      )}

      {/* Progress bar */}
      {totalGroups > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-gradient-card p-4">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 font-medium">
              <span className="font-mono tabular-nums text-primary">{reviewedCount}</span>
              <span className="text-muted-foreground">of</span>
              <span className="font-mono tabular-nums">{totalGroups}</span>
              <span className="text-muted-foreground">groups reviewed</span>
            </div>
            <div className="font-mono text-xs tabular-nums text-muted-foreground">{pct}%</div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-primary shadow-glow-soft transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm">Scanning for duplicates…</p>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="mt-6 flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium text-destructive">
            {error instanceof Error ? error.message : "Failed to load duplicates"}
          </p>
        </div>
      )}

      {/* No folder configured */}
      {!isLoading && !folderPath && (
        <div className="mt-12 flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-medium">No folder selected — go to Settings to choose a folder.</p>
        </div>
      )}

      {/* Empty — folder set but no duplicates found */}
      {!isLoading && !isError && visibleGroups.length === 0 && folderPath && (
        <div className="mt-12 flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Check className="h-10 w-10 text-primary" strokeWidth={2} />
          <p className="text-sm font-medium">
            {dismissedIds.size > 0 ? "All reviewed groups have been trashed." : "No duplicates detected in this folder."}
          </p>
        </div>
      )}

      {/* Groups */}
      {!isLoading && !isError && visibleGroups.length > 0 && (
        <div className="mt-6 space-y-4">
          {visibleGroups.map((group, gi) => (
            <GroupCard
              key={group.group_id}
              group={group}
              index={gi}
              isKept={kept.has(group.group_id)}
              userSelectedKeep={userSelections[group.group_id]}
              onKeepBest={() => toggleKept(group.group_id)}
              onReviewAll={() => { if (!kept.has(group.group_id)) toggleKept(group.group_id); }}
              onSelectKeep={(filePath) => handleSelectKeep(group.group_id, filePath)}
            />
          ))}
        </div>
      )}

      {/* Floating action bar — sits above the bottom nav on mobile */}
      {activeKeptCount > 0 && (
        <div className="sticky bottom-20 mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-surface-elevated/90 p-4 shadow-elev backdrop-blur-xl md:bottom-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
              <Trash2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">
                {activeKeptCount} group{activeKeptCount !== 1 ? "s" : ""} reviewed · files will be trashed
              </div>
              <div className="text-xs text-muted-foreground">
                Frees {formatBytes(selectedSavings)} · moved to system Bin first
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setKept(new Set())}
              disabled={isDeleting}
              className="flex-1 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground disabled:opacity-50 md:flex-none md:py-2"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground transition-smooth hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 md:flex-none md:py-2"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {isDeleting ? "Moving to Trash…" : `Delete Duplicates (${formatBytes(selectedSavings)})`}
            </button>
          </div>
        </div>
      )}

      {/* Bulk action info toast */}
      {infoToast && (
        <div className="fixed bottom-24 left-4 right-4 z-50 flex items-start gap-3 rounded-xl border border-border bg-surface-elevated/95 p-4 shadow-elev backdrop-blur-xl md:bottom-6 md:left-auto md:right-6 md:w-[340px]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Wand2 className="h-4 w-4" />
          </div>
          <div className="flex-1 text-sm font-medium">{infoToast.message}</div>
          <button
            onClick={() => setInfoToast(null)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Delete success toast */}
      {toast && (
        <div className="fixed bottom-24 left-4 right-4 z-50 flex items-start gap-3 rounded-xl border border-border bg-surface-elevated/95 p-4 shadow-elev backdrop-blur-xl md:bottom-6 md:left-auto md:right-6 md:w-[340px]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Check className="h-4 w-4" strokeWidth={3} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">
              {toast.deleted} file{toast.deleted !== 1 ? "s" : ""} moved to Trash
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {formatBytes(toast.freed_bytes)} recovered · check your system Bin to undo
            </div>
          </div>
          <button
            onClick={() => setToast(null)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </AppShell>
  );
}

// ── GroupCard ─────────────────────────────────────────────────────────────────

interface GroupCardProps {
  group: DuplicateGroup;
  index: number;
  isKept: boolean;
  userSelectedKeep?: string;
  onKeepBest: () => void;
  onReviewAll: () => void;
  onSelectKeep: (filePath: string) => void;
}

function GroupCard({ group, index, isKept, userSelectedKeep, onKeepBest, onReviewAll, onSelectKeep }: GroupCardProps) {
  const effectiveKeep = userSelectedKeep ?? group.recommended_keep;
  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-gradient-card transition-smooth ${
        isKept ? "border-primary/50" : "border-border"
      }`}
    >
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Group {String(index + 1).padStart(2, "0")}
          </div>
          <div className="text-xs text-muted-foreground">
            {group.files.length} {matchLabel(group)} · {formatBytes(savingsForGroup(group))} recoverable
          </div>
          {(group.match_type ?? group.duplicate_type) === "exact" && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-destructive">
              Exact
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onKeepBest}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
          >
            <SkipForward className="h-3 w-3" /> Skip
          </button>
          <button
            onClick={onReviewAll}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-smooth hover:bg-accent ${
              isKept
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-surface"
            }`}
          >
            <Eye className="h-3 w-3" />
            {isKept ? "Reviewed ✓" : "Review all"}
          </button>
          <button
            onClick={onKeepBest}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-glow-soft transition-smooth hover:scale-[1.02] ${
              isKept
                ? "border border-primary/40 bg-primary/20 text-primary"
                : "bg-primary text-primary-foreground"
            }`}
          >
            <Check className="h-3 w-3" strokeWidth={3} />
            {isKept ? "Kept ✓" : "Keep best"}
          </button>
        </div>
      </div>

      {/* On mobile: horizontal scroll; on desktop: grid */}
      <div className="flex gap-3 overflow-x-auto p-4 pb-3 md:grid md:overflow-visible md:p-5"
           style={{ gridTemplateColumns: `repeat(${Math.min(group.files.length, 5)}, minmax(0, 1fr))` }}>
        {group.files.map((file) => {
          const isBest = file.path === effectiveKeep;
          return (
            <div key={file.path} className="min-w-[160px] shrink-0 md:min-w-0 md:shrink">
              <FileCard
                file={file}
                isBest={isBest}
                groupReviewed={isKept}
                onClick={() => onSelectKeep(file.path)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── FileCard ──────────────────────────────────────────────────────────────────

interface FileCardProps {
  file: MediaFile;
  isBest: boolean;
  groupReviewed: boolean;
  onClick: () => void;
}

function FileCard({ file, isBest, groupReviewed, onClick }: FileCardProps) {
  const markedDelete = groupReviewed && !isBest;
  const markedKeep = groupReviewed && isBest;

  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer overflow-hidden rounded-xl border bg-card transition-smooth ${
        markedDelete
          ? "border-destructive/50 opacity-60"
          : markedKeep
            ? "border-primary/60 shadow-glow-soft"
            : isBest
              ? "border-primary/60 shadow-glow-soft"
              : "border-border opacity-80 hover:opacity-100"
      }`}
    >
      <div className="relative aspect-[4/3]">
        <img
          src={fileUrl(file.path)}
          alt={file.filename}
          loading="lazy"
          className="h-full w-full object-cover transition-[filter] duration-200 group-hover:brightness-110"
        />

        {/* Keep / Delete badge (shown after review) */}
        {markedKeep && (
          <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary-foreground shadow-glow-soft">
            ★ Keep
          </div>
        )}
        {markedDelete && (
          <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-md bg-destructive px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-destructive-foreground">
            <Trash2 className="h-2.5 w-2.5" /> Delete
          </div>
        )}

        {/* Recommended badge (shown before review) */}
        {isBest && !groupReviewed && (
          <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary-foreground shadow-glow-soft">
            ★ Recommended
          </div>
        )}

        <div className="absolute right-2.5 top-2.5">
          <MemoryScore score={5} size="sm" />
        </div>
      </div>

      <div className="p-3">
        <div className="truncate font-mono text-[10px] font-medium" title={file.filename}>
          {file.filename}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <div className="text-muted-foreground">Size</div>
            <div className="font-mono font-semibold tabular-nums">{formatBytes(file.size_bytes)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Date</div>
            <div className="font-mono font-semibold tabular-nums">
              {formatDate(file.modified_at).split(",")[0]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
