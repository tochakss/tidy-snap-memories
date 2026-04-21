import { Link, useRouterState } from "@tanstack/react-router";
import { Camera, FolderOpen, Copy, Sparkles, Upload, Search, Settings, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: "/" | "/duplicates" | "/curation" | "/publish" | "/search";
  label: string;
  icon: typeof FolderOpen;
  badge?: number;
};

const navItems: NavItem[] = [
  { to: "/", label: "Library", icon: FolderOpen },
  { to: "/duplicates", label: "Duplicates", icon: Copy, badge: 234 },
  { to: "/curation", label: "Curation", icon: Sparkles },
  { to: "/publish", label: "Publish", icon: Upload },
  { to: "/search", label: "Search", icon: Search },
];

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[220px] flex-col border-r border-border bg-surface/60 backdrop-blur-xl">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 pt-6 pb-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow-soft">
          <Camera className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-[15px] font-bold tracking-tight">TidySnaps</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">v1.2 · local</div>
        </div>
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
                  {item.badge && (
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

      {/* Storage freed metric */}
      <div className="px-4 pb-3">
        <div className="rounded-xl border border-border bg-gradient-card p-3.5">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <HardDrive className="h-3 w-3" />
            Storage freed
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-bold tracking-tight text-primary">2.3</span>
            <span className="text-xs font-medium text-muted-foreground">GB</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[34%] rounded-full bg-gradient-primary shadow-glow-soft" />
          </div>
          <div className="mt-1.5 text-[10px] text-muted-foreground">34% of recoverable</div>
        </div>
      </div>

      {/* Avatar */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/40 text-[11px] font-bold text-primary-foreground">
            AK
          </div>
          <div className="text-xs">
            <div className="font-semibold">Alex K.</div>
            <div className="text-[10px] text-muted-foreground">Local library</div>
          </div>
        </div>
        <button className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground" aria-label="Settings">
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}
