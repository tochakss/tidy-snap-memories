/**
 * Mode detection: discovers whether the local backend is reachable.
 *
 * "local"   → FastAPI backend on localhost:8000 is up; all features available.
 * "browser" → No backend; all processing runs in the browser via JS.
 *
 * Detection fires once on first call; result is cached in the module.
 * React components should consume ModeContext rather than calling detectMode()
 * directly — the context is seeded by AppShell on mount.
 */
import { createContext, useContext } from "react";

export type AppMode = "local" | "browser";

let _cached: AppMode | null = null;
let _pending: Promise<AppMode> | null = null;

function _fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id));
}

/** Resolve the current mode. Subsequent calls return the cached value. */
export function detectMode(): Promise<AppMode> {
  if (_cached !== null) return Promise.resolve(_cached);
  if (_pending) return _pending;
  _pending = _fetchWithTimeout("http://localhost:8000/health", 2000)
    .then((r) => (_cached = r.ok ? "local" : "browser"))
    .catch(() => (_cached = "browser"));
  return _pending;
}

/** Synchronous read of the last detected mode. "browser" until proven local. */
export function getCachedMode(): AppMode {
  return _cached ?? "browser";
}

export const ModeContext = createContext<AppMode>("browser");
export const useMode = () => useContext(ModeContext);

/** True while the initial health-check is in flight; false once mode is known. */
export const ModeDetectingContext = createContext<boolean>(true);
export const useModeDetecting = () => useContext(ModeDetectingContext);
