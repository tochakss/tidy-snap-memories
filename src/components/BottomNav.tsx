import { Link, useRouterState } from "@tanstack/react-router";
import { FolderOpen, Copy, Sparkles, Upload, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Library", icon: FolderOpen },
  { to: "/duplicates", label: "Dupes", icon: Copy },
  { to: "/curation", label: "Curation", icon: Sparkles },
  { to: "/publish", label: "Publish", icon: Upload },
  { to: "/search", label: "Search", icon: Search },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {items.map(({ to, label, icon: Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon
              className={cn("h-5 w-5", active && "text-primary")}
              strokeWidth={active ? 2.5 : 2}
            />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
