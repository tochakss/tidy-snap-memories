import { useRef, useState } from "react";
import {
  FolderOpen, User, Upload, CheckCircle2, AlertCircle, Chrome,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { saveSettings } from "@/lib/settings";
import { scanFolder } from "@/lib/api";
import { useMode } from "@/lib/mode";
import { browserScanFromDirectory, browserScanFromFiles } from "@/lib/browser_processor";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const SUPPORTED_EXTS = /\.(jpe?g|png|heic|heif|webp|avif|gif|bmp|tiff?|mp4|mov|avi|mkv|wmv|flv|webm|m4v)$/i;
const supportsDirectoryPicker = typeof window !== "undefined" && "showDirectoryPicker" in window;

// Count only the top-level media files in a directory handle (fast preview).
async function countMediaInHandle(handle: FileSystemDirectoryHandle): Promise<number> {
  let count = 0;
  try {
    for await (const [, entry] of (handle as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
      if (entry.kind === "file" && SUPPORTED_EXTS.test((entry as FileSystemFileHandle).name)) {
        count++;
      }
    }
  } catch {
    // non-fatal
  }
  return count;
}

export function SettingsModal({ open, onClose, onSaved }: Props) {
  const mode = useMode();
  const [name, setName] = useState("");

  // ── local mode state ───────────────────────────────────────────────────────
  const [folderPath, setFolderPath] = useState("");
  // Picked directory handle (local mode only — used for file count preview)
  const [localDirHandle, setLocalDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [localDirName, setLocalDirName] = useState<string | null>(null);
  const [localFileCount, setLocalFileCount] = useState<number | null>(null);
  const [countingFiles, setCountingFiles] = useState(false);
  // Show the manual text-input — hidden by default when picker is available
  const [showManualInput, setShowManualInput] = useState(!supportsDirectoryPicker);

  // ── browser mode state ─────────────────────────────────────────────────────
  const [fileCount, setFileCount] = useState<number | null>(null);
  const [dirName, setDirName] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[] | null>(null);
  const [selectedDirHandle, setSelectedDirHandle] = useState<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── shared ─────────────────────────────────────────────────────────────────
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");

  // ── local mode: folder picker ──────────────────────────────────────────────

  async function handleLocalPickDirectory() {
    try {
      const handle = await (
        window as unknown as { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }
      ).showDirectoryPicker();

      setLocalDirHandle(handle);
      setLocalDirName(handle.name);
      setFolderPath("");           // cleared — user types the full absolute path
      setShowManualInput(true);    // auto-reveal so user can complete the full path
      setError("");

      // Count media files asynchronously
      setCountingFiles(true);
      setLocalFileCount(null);
      countMediaInHandle(handle)
        .then((n) => setLocalFileCount(n))
        .finally(() => setCountingFiles(false));
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError("Folder picker failed — please enter the path manually.");
        setShowManualInput(true);
      }
    }
  }

  function handleClearLocalPick() {
    setLocalDirHandle(null);
    setLocalDirName(null);
    setLocalFileCount(null);
    setCountingFiles(false);
    setFolderPath("");
    setShowManualInput(!supportsDirectoryPicker);
  }

  // ── local mode submit ──────────────────────────────────────────────────────

  async function handleLocalSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!folderPath.trim()) {
      setError("Please enter the full folder path (e.g. /Users/you/Pictures).");
      setShowManualInput(true);
      return;
    }
    setError("");
    setProcessing(true);
    try {
      saveSettings(name.trim(), folderPath.trim());
      await scanFolder(folderPath.trim());
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed. Check the folder path and try again.");
    } finally {
      setProcessing(false);
    }
  }

  // ── browser mode: directory picker ────────────────────────────────────────

  async function handlePickDirectory() {
    try {
      const handle = await (window as unknown as { showDirectoryPicker(): Promise<unknown> }).showDirectoryPicker();
      const dir = handle as { name: string };
      setSelectedDirHandle(handle);
      setSelectedFiles(null);
      setDirName(dir.name);
      setFileCount(null);
      setError("");
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError("Could not open folder. Try uploading files instead.");
      }
    }
  }

  // ── browser mode: file input fallback ────────────────────────────────────

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => SUPPORTED_EXTS.test(f.name));
    if (files.length === 0) {
      setError("No supported media files found in your selection.");
      return;
    }
    if (files.length > 200) {
      setError(`${files.length} files selected — browser mode supports up to 200. Please select a subset.`);
      return;
    }
    setSelectedFiles(files);
    setSelectedDirHandle(null);
    setDirName(null);
    setFileCount(files.length);
    setError("");
  }

  // ── browser mode submit ────────────────────────────────────────────────────

  async function handleBrowserSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!selectedDirHandle && !selectedFiles) {
      setError("Please select a folder or upload photos first.");
      return;
    }
    setError("");
    setProcessing(true);
    setProgress(null);
    try {
      const onProg = (done: number, total: number) => setProgress({ done, total });
      if (selectedDirHandle) {
        await browserScanFromDirectory(selectedDirHandle, onProg);
      } else {
        await browserScanFromFiles(selectedFiles!, onProg);
      }
      saveSettings(name.trim(), "__browser__");
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed. Please try again.");
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  }

  const browserHasSelection = !!(selectedDirHandle || selectedFiles);
  const browserSelectionLabel = dirName
    ? `📁 ${dirName}`
    : fileCount !== null
      ? `${fileCount} file${fileCount !== 1 ? "s" : ""} selected`
      : null;

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[95dvh] overflow-y-auto gap-0 p-0 overflow-hidden sm:max-w-md">
        {/* Header band */}
        <div className="bg-gradient-primary px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-primary-foreground">
              Welcome to TidySnaps
            </DialogTitle>
            <DialogDescription className="text-sm text-primary-foreground/70">
              {mode === "browser"
                ? "Select your photos — everything stays in your browser."
                : "Tell us your name and point us to your media folder to get started."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <form
          onSubmit={mode === "browser" ? handleBrowserSave : handleLocalSave}
          className="flex flex-col gap-5 p-6"
        >
          {/* Name (shared) */}
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
              className="w-full rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[48px]"
            />
          </div>

          {mode === "local" ? (
            /* ── Local mode: folder picker + manual path input ── */
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <FolderOpen className="h-3 w-3" />
                Select your media folder
              </label>

              {supportsDirectoryPicker ? (
                <div>
                  {/* Single picker button — shows folder name + ✓ once selected */}
                  <button
                    type="button"
                    onClick={handleLocalPickDirectory}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-left flex items-center gap-3 transition-colors hover:border-primary min-h-[48px]"
                  >
                    <span className="text-xl">📁</span>
                    <span className="flex-1 text-sm text-foreground">
                      {localDirName
                        ? localDirName
                        : <span className="text-muted-foreground">Browse and select your media folder</span>}
                    </span>
                    {localDirName && (
                      <span className="text-xs font-semibold text-emerald-500">✓</span>
                    )}
                  </button>

                  {/* File count below the button */}
                  {localDirName && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {countingFiles
                        ? "Counting files…"
                        : localFileCount !== null
                          ? `~${localFileCount} media files detected`
                          : ""}
                    </p>
                  )}

                  {/* "enter path manually" toggle */}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Or{" "}
                    <button
                      type="button"
                      onClick={() => setShowManualInput(!showManualInput)}
                      className="underline transition-colors hover:text-foreground"
                    >
                      enter path manually
                    </button>
                  </p>

                  {/* Manual path input — auto-revealed after picking, or on toggle */}
                  {showManualInput && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      <input
                        type="text"
                        value={folderPath}
                        onChange={(e) => setFolderPath(e.target.value)}
                        placeholder={
                          localDirName
                            ? `/Users/yourname/${localDirName}`
                            : "/Users/yourname/Pictures"
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[48px]"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {localDirName ? (
                          <>
                            Full path needed — folder is{" "}
                            <span className="font-mono font-medium text-foreground">{localDirName}</span>
                            {". "}Add the parent path above.
                          </>
                        ) : (
                          "Paste the absolute path to the folder you want to scan."
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Safari/Firefox fallback — manual input only */
                <div className="flex flex-col gap-1.5">
                  <input
                    type="text"
                    placeholder="/Users/yourname/Pictures"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[48px]"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Paste the absolute path to the folder you want to scan.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* ── Browser mode: file / directory picker (unchanged) ── */
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <FolderOpen className="h-3 w-3" />
                Select photos to analyze
              </label>

              {supportsDirectoryPicker ? (
                <>
                  <button
                    type="button"
                    onClick={handlePickDirectory}
                    className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background py-5 text-sm font-medium text-muted-foreground transition-smooth hover:border-primary/50 hover:bg-accent hover:text-foreground"
                  >
                    <FolderOpen className="h-4 w-4" />
                    {browserSelectionLabel ?? "📁 Select Folder"}
                  </button>
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-500">
                    <CheckCircle2 className="h-3 w-3" />
                    Full folder access supported in your browser
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background py-5 text-sm font-medium text-muted-foreground transition-smooth hover:border-primary/50 hover:bg-accent hover:text-foreground"
                  >
                    <Upload className="h-4 w-4" />
                    {browserSelectionLabel ?? "📱 Select Photos"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                  <div className="flex items-start gap-1.5 text-[11px] text-amber-500">
                    <Chrome className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      Use Chrome or Edge for full folder access. Safari/Firefox: select up to 200 photos at a time.
                    </span>
                  </div>
                </>
              )}

              {/* Progress during browser scan */}
              {processing && progress && (
                <div className="mt-1">
                  <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>Scanning… {progress.done} of {progress.total}</span>
                    <span className="font-mono tabular-nums">
                      {Math.round((progress.done / progress.total) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-primary transition-all duration-200"
                      style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Large library warning */}
              {fileCount !== null && fileCount > 500 && (
                <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-[11px] text-amber-400">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>
                    Large library detected — processing {fileCount} files may take 5–10 minutes. Keep this tab open.
                  </span>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={processing || (mode === "browser" && !browserHasSelection)}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-smooth hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 min-h-[48px]"
          >
            {processing ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                {progress ? `Scanning… ${progress.done} / ${progress.total}` : "Processing…"}
              </>
            ) : mode === "browser" ? (
              "Save & Process"
            ) : (
              "Save & Scan"
            )}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
