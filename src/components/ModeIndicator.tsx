import { Zap, Globe } from "lucide-react";
import { useMode } from "@/lib/mode";

export function ModeIndicator() {
  const mode = useMode();

  if (mode === "local") {
    return (
      <div
        title="Connected to local backend — all features available"
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-400/10"
      >
        <Zap className="h-2.5 w-2.5" />
        Local
      </div>
    );
  }

  return (
    <div
      title="Browser mode — duplicate detection and CV scoring available locally. AI features require the desktop app."
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-sky-400 bg-sky-400/10"
    >
      <Globe className="h-2.5 w-2.5" />
      Browser
    </div>
  );
}
