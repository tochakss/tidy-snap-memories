import { Check, Trash2, Info, Play } from "lucide-react";
import { Photo } from "@/lib/photos";
import { MemoryScore } from "./MemoryScore";
import { cn } from "@/lib/utils";

interface Props {
  photo: Photo;
  onClick?: () => void;
  className?: string;
  aspectClass?: string;
  showScore?: boolean;
}

export function PhotoCard({ photo, onClick, className, aspectClass, showScore = true }: Props) {
  const isVideo = photo.type === "MP4" || photo.type === "MOV";
  const aspect =
    aspectClass ??
    (photo.aspect === "tall" ? "aspect-[3/4]" : photo.aspect === "wide" ? "aspect-[4/3]" : "aspect-square");

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative block w-full overflow-hidden rounded-2xl border border-border bg-card text-left transition-smooth",
        "hover:-translate-y-0.5 hover:border-border-strong hover:shadow-elev",
        aspect,
        className,
      )}
    >
      <img
        src={photo.src}
        alt={photo.filename}
        loading="lazy"
        className="h-full w-full object-cover transition-smooth group-hover:scale-[1.04]"
      />

      {/* Bottom gradient + score */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-smooth group-hover:opacity-100" />

      {/* Score badge */}
      {showScore && (
        <div className="absolute bottom-2.5 left-2.5">
          <MemoryScore score={photo.score} size="sm" />
        </div>
      )}

      {/* Type badge */}
      <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-white backdrop-blur-md">
        {isVideo && <Play className="h-2 w-2 fill-current" />}
        {photo.type}
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-x-2.5 bottom-2.5 translate-y-2 opacity-0 transition-smooth group-hover:translate-y-0 group-hover:opacity-100">
        <div className="flex items-end justify-between">
          <div className="min-w-0 flex-1 pr-2">
            <div className="truncate font-mono text-[10px] font-medium text-white/90">{photo.filename}</div>
            {photo.event && <div className="truncate text-[10px] text-white/60">{photo.event}</div>}
          </div>
          <div className="flex shrink-0 gap-1">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/90 text-primary-foreground" aria-label="Keep">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/15 text-white backdrop-blur-md" aria-label="Info">
              <Info className="h-3 w-3" />
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-destructive/90 text-destructive-foreground" aria-label="Delete">
              <Trash2 className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
