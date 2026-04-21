import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, X, Check, Edit3, Calendar, Image as ImageIcon, Film } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PhotoCard } from "@/components/PhotoCard";
import { photos, type Photo } from "@/lib/photos";
import { MemoryScore } from "@/components/MemoryScore";

export const Route = createFileRoute("/curation")({
  head: () => ({
    meta: [
      { title: "AI Curation — TidySnaps" },
      { name: "description", content: "AI-curated highlights and Memory Score breakdown for every photo." },
    ],
  }),
  component: CurationPage,
});

const breakdownLabels = [
  { key: "faces", label: "Faces", weight: "30%" },
  { key: "composition", label: "Composition", weight: "20%" },
  { key: "uniqueness", label: "Uniqueness", weight: "20%" },
  { key: "quality", label: "Quality", weight: "15%" },
  { key: "brightness", label: "Brightness", weight: "15%" },
] as const;

function CurationPage() {
  const sorted = [...photos].sort((a, b) => b.score - a.score);
  const highlights = sorted.slice(0, 5);
  const [selected, setSelected] = useState<Photo | null>(sorted[0] ?? null);

  return (
    <AppShell>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">AI Curation</div>
        <h1 className="mt-2 text-[34px] font-bold leading-tight tracking-tight">
          The best of your year, automatically.
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Memory Scores rank every photo so the moments that matter rise to the top.
        </p>
      </div>

      {/* Highlights carousel */}
      <div className="mt-8 rounded-3xl border border-border bg-gradient-card p-6">
        <div className="mb-4 flex items-end justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold tracking-tight">Best of June 2025</h2>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">5 picks · curated</span>
          </div>
          <button className="text-xs font-medium text-muted-foreground transition-smooth hover:text-foreground">
            View album →
          </button>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {highlights.map((p, i) => (
            <div key={p.id} className={i === 0 ? "col-span-2 row-span-2" : ""}>
              <PhotoCard
                photo={p}
                onClick={() => setSelected(p)}
                aspectClass={i === 0 ? "aspect-[4/3]" : "aspect-square"}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Layout: filters + grid + side panel */}
      <div className="mt-8 grid grid-cols-[200px_1fr_320px] gap-6">
        {/* Filter panel */}
        <aside className="space-y-5">
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Memory Score
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span>1</span>
                <span className="text-primary font-semibold">4 – 10</span>
                <span>10</span>
              </div>
              <div className="relative mt-2 h-1 rounded-full bg-muted">
                <div className="absolute left-[33%] right-0 h-full rounded-full bg-primary" />
                <div className="absolute left-[33%] top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background" />
                <div className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-primary bg-background" />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Date range
            </div>
            <button className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-3 py-2.5 text-xs">
              <span className="flex items-center gap-2"><Calendar className="h-3 w-3" /> Jan – Sep 2025</span>
              <span className="text-muted-foreground">▾</span>
            </button>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Media type
            </div>
            <div className="flex gap-1 rounded-xl border border-border bg-surface p-1 text-xs">
              <button className="flex-1 rounded-lg bg-accent py-1.5 font-medium">All</button>
              <button className="flex-1 rounded-lg py-1.5 text-muted-foreground"><ImageIcon className="mx-auto h-3 w-3" /></button>
              <button className="flex-1 rounded-lg py-1.5 text-muted-foreground"><Film className="mx-auto h-3 w-3" /></button>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Show
            </div>
            <div className="space-y-1.5 text-xs">
              {["All", "Keep candidates", "Delete candidates"].map((opt, i) => (
                <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-smooth hover:bg-accent/50">
                  <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${i === 1 ? "border-primary bg-primary text-primary-foreground" : "border-border-strong"}`}>
                    {i === 1 && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                  </span>
                  {opt}
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Grid */}
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">Library by Memory Score</h3>
            <span className="text-[11px] text-muted-foreground">{sorted.length} items</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {sorted.map((p) => (
              <div
                key={p.id}
                className={`relative ${selected?.id === p.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-2xl" : ""}`}
              >
                <PhotoCard photo={p} onClick={() => setSelected(p)} aspectClass="aspect-square" />
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        {selected && (
          <aside className="sticky top-6 h-fit overflow-hidden rounded-2xl border border-border bg-surface-elevated animate-slide-in-right">
            <div className="relative aspect-[4/3]">
              <img src={selected.src} alt={selected.filename} className="h-full w-full object-cover" />
              <button
                onClick={() => setSelected(null)}
                className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-smooth hover:bg-black/80"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <MemoryScore score={selected.score} size="lg" />
                <span className="rounded-md bg-black/60 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur-md">
                  {selected.type}
                </span>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <div className="truncate font-mono text-[11px] font-medium text-muted-foreground">{selected.filename}</div>
                <div className="mt-0.5 text-sm font-semibold">{selected.event ?? "Untitled event"}</div>
              </div>

              {/* Breakdown */}
              <div>
                <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Score breakdown
                </div>
                <div className="space-y-2">
                  {breakdownLabels.map((b) => {
                    const val = selected.breakdown?.[b.key as keyof typeof selected.breakdown] ?? 0;
                    return (
                      <div key={b.key}>
                        <div className="mb-1 flex items-center justify-between text-[11px]">
                          <span className="font-medium">{b.label}</span>
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {val} <span className="opacity-50">· {b.weight}</span>
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-primary"
                            style={{ width: `${val}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI reasoning */}
              <div className="relative rounded-xl border-l-2 border-primary bg-card p-3.5">
                <div className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-primary">
                  ▍AI Analysis
                </div>
                <p className="text-xs leading-relaxed text-foreground/90">
                  {selected.reasoning}
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-1">
                <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-glow-soft transition-smooth hover:scale-[1.02]">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} /> Accept
                </button>
                <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface py-2.5 text-xs font-semibold transition-smooth hover:bg-accent">
                  <Edit3 className="h-3 w-3" /> Override
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </AppShell>
  );
}
