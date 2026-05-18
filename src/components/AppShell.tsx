import { ReactNode, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "./Sidebar";
import { SettingsModal } from "./SettingsModal";
import { getSettings } from "@/lib/settings";

export function AppShell({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const s = getSettings();
    if (!s.name || !s.folderPath) setSettingsOpen(true);
  }, []);

  function handleSaved() {
    queryClient.invalidateQueries();
  }

  return (
    <>
      <div className="min-h-screen">
        <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
        <main className="ml-[220px] min-h-screen">
          <div className="mx-auto max-w-[1400px] px-10 py-8">{children}</div>
        </main>
      </div>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={handleSaved}
      />
    </>
  );
}
