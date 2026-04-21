import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="ml-[220px] min-h-screen">
        <div className="mx-auto max-w-[1400px] px-10 py-8">{children}</div>
      </main>
    </div>
  );
}
