import { cn } from "@/lib/utils";
import { scoreColor } from "@/lib/photos";

interface Props {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function MemoryScore({ score, size = "md", className }: Props) {
  const tone = scoreColor(score);

  const toneClasses = {
    high: "bg-primary text-primary-foreground score-glow-high",
    mid: "bg-warning text-warning-foreground score-glow-mid",
    low: "bg-destructive text-destructive-foreground score-glow-low",
  }[tone];

  const sizeClasses = {
    sm: "h-5 px-1.5 text-[10px] font-bold",
    md: "h-6 px-2 text-xs font-bold",
    lg: "h-8 px-3 text-sm font-bold",
  }[size];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-mono tabular-nums tracking-tight",
        toneClasses,
        sizeClasses,
        className,
      )}
    >
      {score}
    </span>
  );
}
