import { useState } from "react";
import { FolderOpen, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { saveSettings } from "@/lib/settings";
import { scanFolder } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function SettingsModal({ open, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [folderPath, setFolderPath] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !folderPath.trim()) {
      setError("Both fields are required.");
      return;
    }
    setError("");
    setScanning(true);
    try {
      saveSettings(name.trim(), folderPath.trim());
      await scanFolder(folderPath.trim());
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed. Check the folder path and try again.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
        {/* Header band */}
        <div className="bg-gradient-primary px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-primary-foreground">
              Welcome to TidySnaps
            </DialogTitle>
            <DialogDescription className="text-sm text-primary-foreground/70">
              Tell us your name and point us to your media folder to get started.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-5 p-6">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <User className="h-3 w-3" />
              Your name
            </label>
            <input
              type="text"
              placeholder="e.g. Alex"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Folder path */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FolderOpen className="h-3 w-3" />
              Media folder path
            </label>
            <input
              type="text"
              placeholder="e.g. /Users/you/Pictures"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-[11px] text-muted-foreground">
              Paste an absolute path to the folder you want to scan.
            </p>
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={scanning}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-smooth hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {scanning ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                Scanning folder…
              </>
            ) : (
              "Save & Scan"
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
