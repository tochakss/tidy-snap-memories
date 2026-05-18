import { ReactNode, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Globe, X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { SettingsModal } from "./SettingsModal";
import { getSettings } from "@/lib/settings";
import { detectMode, ModeContext, ModeDetectingContext, type AppMode } from "@/lib/mode";
import { hasBrowserFiles } from "@/lib/browser_processor";

export function AppShell({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mode, setMode] = useState<AppMode | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    detectMode().then((m) => {
      setMode(m);
      const s = getSettings();
      const needsSetup =
        !s.name ||
        !s.folderPath ||
        (m === "browser" && !hasBrowserFiles());
      if (needsSetup) setSettingsOpen(true);
    });
  }, []);

  function handleSaved() {
    queryClient.invalidateQueries();
  }

  // Render nothing until mode is known (avoids flicker between local/browser UI).
  // Detection resolves in <100 ms for local users, ≤2 s for browser users.
  const resolvedMode: AppMode = mode ?? "browser";

  return (
    <ModeDetectingContext.Provider value={mode === null}>
    <ModeContext.Provider value={resolvedMode}>
      <div className="min-h-screen">
        <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
        <main className="ml-[220px] min-h-screen">
          {/* Browser-mode informational banner — only after confirmed, not during detection */}
          {mode === "browser" && !bannerDismissed && (
            <div className="flex items-center justify-between gap-4 border-b border-sky-500/20 bg-sky-500/8 px-6 py-2.5 text-sm text-sky-300">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                <span>
                  Running in browser mode — duplicate detection and quality scoring work locally.
                  For AI features,{" "}
                  <a
                    href="#download"
                    className="font-semibold underline underline-offset-2 hover:text-sky-200 transition-colors"
                  >
                    download the TidySnaps desktop app
                  </a>
                  .
                </span>
              </div>
              <button
                onClick={() => setBannerDismissed(true)}
                className="shrink-0 rounded p-0.5 text-sky-400 transition-colors hover:bg-sky-400/15 hover:text-sky-200"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="mx-auto max-w-[1400px] px-10 py-8">{children}</div>
        </main>
      </div>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={handleSaved}
      />
    </ModeContext.Provider>
    </ModeDetectingContext.Provider>
  );
}
