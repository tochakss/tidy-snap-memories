import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Camera, FolderOpen, Copy, Sparkles, Upload, Search, Settings, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { getDuplicates, scanFolder } from "@/lib/api";
import { useModeDetecting } from "@/lib/mode";
import { ModeIndicator } from "./ModeIndicator";

function fmtStorage(bytes: number): { value: string; unit: string } {
  if (bytes >= 1024 ** 3) return { value: (bytes / 1024 ** 3).toFixed(1), unit: "GB" };
  if (bytes >= 1024 ** 2) return { value: (bytes / 1024 ** 2).toFixed(0), unit: "MB" };
  return { value: Math.round(bytes / 1024).toString(), unit: "KB" };
}

type NavItem = {
  to: "/" | "/duplicates" | "/curation" | "/publish" | "/search";
  label: string;
  icon: typeof FolderOpen;
  badge?: number;
};

const navItems: NavItem[] = [
  { to: "/", label: "Library", icon: FolderOpen },
  { to: "/duplicates", label: "Duplicates", icon: Copy },
  { to: "/curation", label: "Curation", icon: Sparkles },
  { to: "/publish", label: "Publish", icon: Upload },
  { to: "/search", label: "Search", icon: Search },
];

interface Props {
  onOpenSettings?: () => void;
}

export function Sidebar({ onOpenSettings }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const detecting = useModeDetecting();
  const [name, setName] = useState("—");
  const [folderPath, setFolderPath] = useState("Local library");
  const [fullFolderPath, setFullFolderPath] = useState("");

  useEffect(() => {
    const s = getSettings();
    if (s.name) setName(s.name);
    if (s.folderPath) {
      setFolderPath(
        s.folderPath === "__browser__"
          ? "Browser library"
          : s.folderPath.split("/").pop() || s.folderPath,
      );
      setFullFolderPath(s.folderPath);
    }
  }, []);

  const queryEnabled = !!fullFolderPath && !detecting;

  const { data: dupData, isLoading: dupLoading } = useQuery({
    queryKey: ["duplicates", fullFolderPath],
    queryFn: () => getDuplicates(fullFolderPath),
    enabled: queryEnabled,
  });

  // Shares cache with Library page — no extra fetch.
  const { data: scanData } = useQuery({
    queryKey: ["scan", fullFolderPath],
    queryFn: () => scanFolder(fullFolderPath),
    enabled: queryEnabled,
  });

  const dupBadge =
    !dupLoading && dupData
      ? dupData.groups.reduce((acc, g) => acc + Math.max(0, g.files.length - 1), 0)
      : null;

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[220px] flex-col border-r border-border bg-surface/60 backdrop-blur-xl">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow-soft">
          <Camera className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-[15px] font-bold tracking-tight">TidySnaps</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">v1.2</div>
        </div>
      </div>

      {/* Mode badge */}
      <div className="px-5 pb-4">
        <ModeIndicator />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3">
        <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Workspace
        </div>
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth",
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary shadow-glow-soft" />
                  )}
                  <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} strokeWidth={2.25} />
                  <span className="flex-1">{item.label}</span>
                  {item.to === "/duplicates"
                    ? dupBadge != null && dupBadge > 0 && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                          {dupBadge}
                        </span>
                      )
                    : item.badge != null && item.badge > 0 && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                          {item.badge}
                        </span>
                      )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Storage freed metric — only shown when duplicate data is available */}
      {dupData && dupData.total_groups > 0 && (() => {
        const freedBytes = dupData.wasted_bytes;
        const totalBytes = scanData?.media.reduce((acc, m) => acc + m.size_bytes, 0) ?? 0;
        const pct = totalBytes > 0 ? Math.min(100, Math.round((freedBytes / totalBytes) * 100)) : 0;
        const { value, unit } = fmtStorage(freedBytes);
        return (
          <div className="px-4 pb-3">
            <div className="rounded-xl border border-border bg-gradient-card p-3.5">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <HardDrive className="h-3 w-3" />
                Recoverable
              </div>
              <div className="mt-1.5 flex items-baseline gap-1">
                <span className="text-xl font-bold tracking-tight text-primary">{value}</span>
                <span className="text-xs font-medium text-muted-foreground">{unit}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-primary shadow-glow-soft transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1.5 text-[10px] text-muted-foreground">
                {pct}% of library · {dupData.total_groups} duplicate group{dupData.total_groups !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Avatar */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/40 text-[11px] font-bold text-primary-foreground">
            {initials || "?"}
          </div>
          <div className="text-xs">
            <div className="font-semibold">{name}</div>
            <div className="max-w-[110px] truncate text-[10px] text-muted-foreground" title={folderPath}>
              {folderPath}
            </div>
          </div>
        </div>
        <button
          onClick={onOpenSettings}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
          aria-label="Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}
