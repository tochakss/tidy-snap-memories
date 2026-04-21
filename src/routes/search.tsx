import { createFileRoute } from "@tanstack/react-router";
import { Search as SearchIcon, Sparkles, Command } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PhotoCard } from "@/components/PhotoCard";
import { photos } from "@/lib/photos";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search — TidySnaps" },
      { name: "description", content: "Natural-language search across your entire local photo and video library." },
    ],
  }),
  component: SearchPage,
});

const filters = ["All", "Photos", "Videos", "2025", "2024", "2023"];
const suggestions = [
  "birthday party with candles",
  "family at the beach in 2024",
  "Mia's dance performance",
  "newborn first week",
  "snowy mountain sunrise",
  "dog playing in garden",
];

function SearchPage() {
  const query = "family at the beach";
  const results = [photos[1], photos[4], photos[8], photos[3], photos[11], photos[6], photos[5], photos[9]];

  return (
    <AppShell>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Search</div>
        <h1 className="mt-2 text-center text-[34px] font-bold leading-tight tracking-tight">
          Find any moment, instantly.
        </h1>
        <p className="mt-1.5 text-center text-sm text-muted-foreground">
          Powered by on-device vision AI. Nothing leaves your Mac.
        </p>
      </div>

      {/* Big search bar */}
      <div className="mx-auto mt-8 max-w-2xl">
        <div className="group relative">
          <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-primary opacity-30 blur-2xl transition-smooth group-focus-within:opacity-50" />
          <div className="flex items-center gap-3 rounded-2xl border border-border-strong bg-surface-elevated p-2 pl-5 shadow-elev transition-smooth focus-within:border-primary/50">
            <SearchIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
            <input
              defaultValue={query}
              placeholder="birthday party 2025, family at beach, dance performance…"
              className="flex-1 bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground/60"
            />
            <kbd className="hidden items-center gap-0.5 rounded-md border border-border bg-surface px-1.5 py-1 font-mono text-[10px] text-muted-foreground sm:inline-flex">
              <Command className="h-2.5 w-2.5" /> K
            </kbd>
            <button className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow-soft transition-smooth hover:scale-[1.02]">
              <Sparkles className="h-3.5 w-3.5" />
              Search
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {filters.map((f, i) => (
            <button
              key={f}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-smooth ${
                i === 0
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Result meta */}
      <div className="mx-auto mt-10 flex max-w-5xl items-baseline justify-between">
        <div>
          <div className="text-sm">
            <span className="font-semibold">{results.length}</span>
            <span className="text-muted-foreground"> results for </span>
            <span className="rounded-md bg-primary/15 px-1.5 py-0.5 font-medium text-primary">"{query}"</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Searched 12,481 items in 0.42s · ranked by relevance</div>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1 text-xs">
          <button className="rounded-md bg-accent px-3 py-1.5 font-medium">Relevance</button>
          <button className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">Newest</button>
          <button className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">Score</button>
        </div>
      </div>

      {/* Results grid */}
      <div className="mx-auto mt-5 max-w-5xl">
        <div className="columns-2 gap-4 md:columns-3 xl:columns-4">
          {results.map((p, i) => (
            <div key={`${p.id}-${i}`} className="mb-4 break-inside-avoid">
              <div className="group">
                <PhotoCard photo={p} />
                <div className="mt-2 px-1">
                  <div className="truncate font-mono text-[11px] font-medium">{p.filename}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{p.date}</span>
                    <span>·</span>
                    <span>matched: <span className="rounded bg-primary/15 px-1 py-px text-primary">{i % 2 === 0 ? "beach" : "family"}</span></span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty state preview (suggestions) */}
      <div className="mx-auto mt-12 max-w-3xl rounded-3xl border border-dashed border-border bg-surface/40 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-base font-semibold">Try searching by feeling, place, or person</h3>
        <p className="mt-1 text-xs text-muted-foreground">Natural language works — just describe what you remember.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <button key={s} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition-smooth hover:border-primary/50 hover:text-foreground">
              {s}
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
