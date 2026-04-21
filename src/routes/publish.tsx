import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Sparkles, X, Lock, Globe, Clock, Upload, Play, Eye, ThumbsUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { photos } from "@/lib/photos";
import { MemoryScore } from "@/components/MemoryScore";

export const Route = createFileRoute("/publish")({
  head: () => ({
    meta: [
      { title: "Publish to YouTube — TidySnaps" },
      { name: "description", content: "Auto-generate titles, descriptions, and thumbnails for your video uploads." },
    ],
  }),
  component: PublishPage,
});

const steps = [
  { n: 1, label: "Select video" },
  { n: 2, label: "AI metadata" },
  { n: 3, label: "Thumbnail" },
  { n: 4, label: "Upload" },
];

function PublishPage() {
  const [tags, setTags] = useState(["family", "vacation", "summer 2025", "algarve", "kids"]);
  const [hashtags, setHashtags] = useState(["#familyvlog", "#travel", "#summermemories"]);
  const videos = photos.filter((p) => p.type === "MP4" || p.type === "MOV");
  const selectedVideo = videos[0];

  return (
    <AppShell>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Publish</div>
        <h1 className="mt-2 text-[34px] font-bold leading-tight tracking-tight">
          Share your story with the world.
        </h1>
      </div>

      {/* Step indicator */}
      <div className="mt-8 flex items-center gap-2">
        {steps.map((s, i) => {
          const active = s.n === 2;
          const done = s.n < 2;
          return (
            <div key={s.n} className="flex flex-1 items-center gap-2">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                done ? "bg-primary text-primary-foreground" : active ? "bg-primary text-primary-foreground shadow-glow-soft animate-pulse-glow" : "border border-border bg-surface text-muted-foreground"
              }`}>
                {done ? <Check className="h-3 w-3" strokeWidth={3} /> : s.n}
              </div>
              <span className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
              {i < steps.length - 1 && (
                <div className={`h-px flex-1 ${done ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Main two-col */}
      <div className="mt-8 grid grid-cols-[1fr_360px] gap-6">
        {/* Editor */}
        <div className="space-y-4">
          {/* Selected video preview */}
          <div className="overflow-hidden rounded-2xl border border-border bg-gradient-card">
            <div className="flex gap-4 p-4">
              <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-lg">
                <img src={selectedVideo.src} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-foreground">
                    <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                  </div>
                </div>
                <div className="absolute bottom-1.5 right-1.5">
                  <MemoryScore score={selectedVideo.score} size="sm" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] text-muted-foreground">{selectedVideo.filename}</div>
                <div className="mt-1 text-base font-semibold">{selectedVideo.event}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {selectedVideo.size} · 1080p · 0:42 · captured {selectedVideo.date}
                </div>
                <button className="mt-2 text-xs font-medium text-primary">Change video →</button>
              </div>
            </div>
          </div>

          {/* Title field */}
          <FieldCard label="Title" counter="62 / 100">
            <div className="flex items-start gap-2">
              <input
                defaultValue="Spring Recital 2025 — Mia's first solo on stage ✨"
                className="flex-1 bg-transparent text-base font-semibold tracking-tight outline-none"
              />
              <RegenButton />
            </div>
          </FieldCard>

          {/* Description */}
          <FieldCard label="Description" counter="284 chars">
            <div className="flex items-start gap-3">
              <textarea
                defaultValue={"A beautiful evening at the spring recital. Mia performed her first solo and absolutely owned the stage.\n\nFilmed live at the Hartwood Theatre, May 22nd 2025. So proud of her hard work this season — enjoy the show."}
                className="min-h-[120px] flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none"
              />
              <RegenButton />
            </div>
          </FieldCard>

          {/* Tags */}
          <FieldCard label="Tags" counter={`${tags.length} tags`}>
            <div className="flex items-start gap-2">
              <div className="flex flex-1 flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs">
                    {t}
                    <button onClick={() => setTags(tags.filter((x) => x !== t))} className="text-muted-foreground hover:text-foreground">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
                <button className="rounded-md border border-dashed border-border-strong px-2 py-1 text-xs text-muted-foreground transition-smooth hover:text-foreground">+ Add tag</button>
              </div>
              <RegenButton />
            </div>
          </FieldCard>

          {/* Hashtags */}
          <FieldCard label="Hashtags" counter={`${hashtags.length} tags`}>
            <div className="flex items-start gap-2">
              <div className="flex flex-1 flex-wrap gap-1.5">
                {hashtags.map((h) => (
                  <span key={h} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
                    {h}
                    <button onClick={() => setHashtags(hashtags.filter((x) => x !== h))} className="text-primary/60 hover:text-primary">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <RegenButton />
            </div>
          </FieldCard>

          {/* Thumbnail step */}
          <div className="rounded-2xl border border-border bg-gradient-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                ▍Thumbnail · 4 frames extracted
              </div>
              <button className="text-xs font-medium text-muted-foreground hover:text-foreground">Upload custom →</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[selectedVideo, photos[2], photos[6], photos[4]].map((p, i) => (
                <button key={i} className={`group relative overflow-hidden rounded-xl border-2 transition-smooth ${i === 0 ? "border-primary shadow-glow-soft" : "border-transparent hover:border-border-strong"}`}>
                  <div className="aspect-video">
                    <img src={p.src} alt="" className="h-full w-full object-cover" />
                  </div>
                  {i === 0 && (
                    <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary-foreground">
                      ★ Best quality
                    </div>
                  )}
                  {i === 0 && (
                    <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Privacy + upload */}
          <div className="rounded-2xl border border-border bg-gradient-card p-5">
            <div className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              ▍Privacy
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: Lock, label: "Private", desc: "Only you" },
                { icon: Eye, label: "Unlisted", desc: "Anyone with link", active: true },
                { icon: Clock, label: "Scheduled", desc: "Pick a date" },
              ].map((opt) => {
                const Icon = opt.icon;
                return (
                  <button key={opt.label} className={`rounded-xl border p-3 text-left transition-smooth ${opt.active ? "border-primary bg-primary/5" : "border-border bg-surface hover:border-border-strong"}`}>
                    <Icon className={`h-3.5 w-3.5 ${opt.active ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="mt-2 text-xs font-semibold">{opt.label}</div>
                    <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                  </button>
                );
              })}
            </div>

            <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-smooth hover:scale-[1.01]">
              <Upload className="h-4 w-4" />
              Publish to YouTube
              <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            </button>
          </div>
        </div>

        {/* Right: YouTube preview */}
        <aside className="sticky top-6 h-fit space-y-3">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            ▍Search result preview
          </div>
          <div className="rounded-2xl border border-border bg-surface-elevated p-4">
            <div className="relative overflow-hidden rounded-xl">
              <div className="aspect-video">
                <img src={selectedVideo.src} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="absolute bottom-2 right-2 rounded bg-black/85 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                0:42
              </div>
            </div>
            <div className="mt-3 flex gap-2.5">
              <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/40" />
              <div className="min-w-0">
                <div className="line-clamp-2 text-sm font-semibold leading-tight">
                  Spring Recital 2025 — Mia's first solo on stage ✨
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Alex Kim · 1.2K subscribers</div>
                <div className="text-[11px] text-muted-foreground">142 views · just now</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> 42</span>
              <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> 142</span>
            </div>
          </div>

          <div className="rounded-xl border-l-2 border-primary bg-card p-3.5">
            <div className="mb-1 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-primary">
              ▍AI Suggestion
            </div>
            <p className="text-xs leading-relaxed text-foreground/90">
              Adding a sparkle emoji to the title boosted CTR by ~12% on similar family content. Schedule for Sunday 7pm for best reach.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function FieldCard({ label, counter, children }: { label: string; counter?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-card p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          ▍{label}
        </div>
        {counter && <div className="font-mono text-[10px] tabular-nums text-muted-foreground">{counter}</div>}
      </div>
      {children}
    </div>
  );
}

function RegenButton() {
  return (
    <button className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-smooth hover:border-primary/50 hover:text-primary">
      <Sparkles className="h-3 w-3" />
      Regenerate
    </button>
  );
}
