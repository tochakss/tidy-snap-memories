import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, ImageIcon, Copy, HardDrive, Brain, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PhotoCard } from "@/components/PhotoCard";
import { photos } from "@/lib/photos";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Library — TidySnaps" },
      { name: "description", content: "Your full photo and video library, scored and organized by AI." },
    ],
  }),
  component: LibraryPage,
});

const stats = [
  { label: "Total Assets", value: "12,481", sub: "9,204 photos · 3,277 videos", icon: ImageIcon, accent: false },
  { label: "Duplicates Found", value: "234", sub: "across 87 groups", icon: Copy, accent: false },
  { label: "Space Recoverable", value: "4.2 GB", sub: "of 142 GB indexed", icon: HardDrive, accent: true },
  { label: "AI Acceptance Rate", value: "94%", sub: "of recommendations kept", icon: Brain, accent: false },
];

function LibraryPage() {
  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Library</div>
          <h1 className="mt-2 text-[34px] font-bold leading-tight tracking-tight text-balance">
            Welcome back, Alex.
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            12,481 memories indexed · last AI scan 2 hours ago
          </p>
        </div>
        <button className="group inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-smooth hover:scale-[1.02]">
          <Sparkles className="h-4 w-4" strokeWidth={2.5} />
          Run AI Scan
          <ArrowUpRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-4 gap-4">
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

      {/* Section title */}
      <div className="mt-10 mb-4 flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">All memories</h2>
          <p className="text-xs text-muted-foreground">Sorted by date · most recent first</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1 text-xs">
          <button className="rounded-md bg-accent px-3 py-1.5 font-medium">All</button>
          <button className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">Photos</button>
          <button className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">Videos</button>
        </div>
      </div>

      {/* Masonry grid */}
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5">
        {[...photos, ...photos.slice(0, 6)].map((p, i) => (
          <div key={`${p.id}-${i}`} className="mb-4 break-inside-avoid">
            <PhotoCard photo={p} />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
