import { createFileRoute } from "@tanstack/react-router";
import { Check, Trash2, Eye, SkipForward, Undo2, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { duplicateGroups } from "@/lib/photos";
import { MemoryScore } from "@/components/MemoryScore";

export const Route = createFileRoute("/duplicates")({
  head: () => ({
    meta: [
      { title: "Duplicates — TidySnaps" },
      { name: "description", content: "Review and remove duplicate photos and videos to recover storage." },
    ],
  }),
  component: DuplicatesPage,
});

function DuplicatesPage() {
  const reviewed = 14;
  const total = 87;
  const pct = Math.round((reviewed / total) * 100);

  return (
    <AppShell>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Duplicates</div>
        <h1 className="mt-2 text-[34px] font-bold leading-tight tracking-tight">
          234 duplicates found
          <span className="ml-3 text-muted-foreground">· 4.2 GB recoverable</span>
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          We grouped near-identical shots so you can keep the best frame and free up space.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mt-6 rounded-xl border border-border bg-gradient-card p-4">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-medium">
            <span className="font-mono tabular-nums text-primary">{reviewed}</span>
            <span className="text-muted-foreground">of</span>
            <span className="font-mono tabular-nums">{total}</span>
            <span className="text-muted-foreground">groups reviewed</span>
          </div>
          <div className="font-mono text-xs tabular-nums text-muted-foreground">{pct}%</div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-primary shadow-glow-soft transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Groups */}
      <div className="mt-6 space-y-4">
        {duplicateGroups.map((group, gi) => (
          <div
            key={group.id}
            className="overflow-hidden rounded-2xl border border-border bg-gradient-card"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Group {String(gi + 1).padStart(2, "0")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {group.items.length} similar shots · captured within 4 seconds
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground">
                  <SkipForward className="h-3 w-3" /> Skip
                </button>
                <button className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium transition-smooth hover:bg-accent">
                  <Eye className="h-3 w-3" /> Review all
                </button>
                <button className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-glow-soft transition-smooth hover:scale-[1.02]">
                  <Check className="h-3 w-3" strokeWidth={3} /> Keep best
                </button>
              </div>
            </div>

            <div className="grid gap-3 p-5" style={{ gridTemplateColumns: `repeat(${group.items.length}, minmax(0, 1fr))` }}>
              {group.items.map((item) => {
                const isBest = item.id === group.bestId;
                return (
                  <div
                    key={item.id}
                    className={`group relative overflow-hidden rounded-xl border bg-card transition-smooth ${
                      isBest ? "border-primary/60 shadow-glow-soft" : "border-border opacity-80 hover:opacity-100"
                    }`}
                  >
                    <div className="relative aspect-[4/3]">
                      <img src={item.src} alt={item.filename} loading="lazy" className="h-full w-full object-cover" />
                      {isBest && (
                        <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary-foreground shadow-glow-soft">
                          ★ Recommended
                        </div>
                      )}
                      <div className="absolute right-2.5 top-2.5">
                        <MemoryScore score={item.score} size="sm" />
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="truncate font-mono text-[10px] font-medium">{item.filename}</div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
                        <div>
                          <div className="text-muted-foreground">Sharp.</div>
                          <div className="font-mono font-semibold tabular-nums">{item.sharpness}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Size</div>
                          <div className="font-mono font-semibold tabular-nums">{item.size}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Date</div>
                          <div className="font-mono font-semibold tabular-nums">{item.date.split(",")[0]}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Floating action bar */}
      <div className="sticky bottom-6 mt-8 flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface-elevated/90 p-4 shadow-elev backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
            <Trash2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">5 files selected for deletion</div>
            <div className="text-xs text-muted-foreground">Frees 1.8 GB · moved to system Bin first</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground">
            Cancel
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-smooth hover:scale-[1.02]">
            <Trash2 className="h-3.5 w-3.5" />
            Delete Selected (1.8 GB)
          </button>
        </div>
      </div>

      {/* Toast */}
      <div className="fixed bottom-6 right-6 z-50 flex w-[340px] items-start gap-3 rounded-xl border border-border bg-surface-elevated/95 p-4 shadow-elev backdrop-blur-xl animate-slide-up">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Check className="h-4 w-4" strokeWidth={3} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">12 duplicates removed</div>
          <div className="mt-0.5 text-xs text-muted-foreground">412 MB recovered to your drive</div>
        </div>
        <button className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-smooth hover:text-foreground">
          <Undo2 className="h-3 w-3" /> Undo
        </button>
      </div>
    </AppShell>
  );
}
