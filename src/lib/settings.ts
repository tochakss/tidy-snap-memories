const KEY = "tidysnaps_settings";

export interface Settings {
  name: string;
  folderPath: string;
}

export function saveSettings(name: string, folderPath: string): void {
  localStorage.setItem(KEY, JSON.stringify({ name, folderPath }));
}

export function getSettings(): Settings {
  if (typeof window === "undefined") return { name: "", folderPath: "" };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { name: "", folderPath: "" };
    return JSON.parse(raw) as Settings;
  } catch {
    return { name: "", folderPath: "" };
  }
}

export function clearSettings(): void {
  localStorage.removeItem(KEY);
}
