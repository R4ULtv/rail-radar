import { File, Paths } from "expo-file-system";
import { useSyncExternalStore } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type MapStyle = "simple" | "streets";

type Preferences = {
  theme: ThemePreference;
  mapStyle: MapStyle;
  welcomeSeen: boolean;
  nearbyButtonUsed: boolean;
  lastSeenRelease: string | null;
};

const defaults: Preferences = {
  theme: "system",
  mapStyle: "simple",
  welcomeSeen: false,
  nearbyButtonUsed: false,
  lastSeenRelease: null,
};

const file = new File(Paths.document, "preferences.json");
const listeners = new Set<() => void>();
let preferences: Preferences | null = null;
let legacyFilesToRemove: File[] = [];

function normalize(value: unknown): Preferences {
  if (!value || typeof value !== "object") return { ...defaults };
  const saved = value as Partial<Preferences>;
  return {
    theme:
      saved.theme === "light" || saved.theme === "dark" || saved.theme === "system"
        ? saved.theme
        : defaults.theme,
    mapStyle:
      saved.mapStyle === "simple" || saved.mapStyle === "streets"
        ? saved.mapStyle
        : defaults.mapStyle,
    welcomeSeen: typeof saved.welcomeSeen === "boolean" ? saved.welcomeSeen : defaults.welcomeSeen,
    nearbyButtonUsed:
      typeof saved.nearbyButtonUsed === "boolean"
        ? saved.nearbyButtonUsed
        : defaults.nearbyButtonUsed,
    lastSeenRelease:
      typeof saved.lastSeenRelease === "string" ? saved.lastSeenRelease : defaults.lastSeenRelease,
  };
}

function readLegacy(fileName: string, existenceOnly = false): unknown {
  try {
    const legacy = new File(Paths.document, fileName);
    if (!legacy.exists) return null;
    legacyFilesToRemove.push(legacy);
    // These flags were recorded by the presence of a file, regardless of its contents.
    return existenceOnly ? true : JSON.parse(legacy.textSync());
  } catch {
    return null;
  }
}

function persist() {
  try {
    if (!file.exists) file.create();
    file.write(JSON.stringify({ version: 1, ...preferences }));
  } catch {
    // Changes still work in memory. Retry the full snapshot on the next update.
    return;
  }

  // Only remove the old files once their values are safely in preferences.json.
  legacyFilesToRemove = legacyFilesToRemove.filter((legacy) => {
    try {
      if (legacy.exists) legacy.delete();
      return false;
    } catch {
      return true;
    }
  });
}

/** Loaded once, synchronously, so theme and first-launch UI are ready before rendering. */
function read(): Preferences {
  if (preferences) return preferences;
  try {
    if (file.exists) {
      preferences = normalize(JSON.parse(file.textSync()));
      return preferences;
    }
  } catch {
    // A failed migration may have created an empty file. Recover from the old files if present.
  }

  const changelog = readLegacy("changelog.json");
  preferences = normalize({
    theme: readLegacy("theme.json"),
    mapStyle: readLegacy("map-style.json"),
    welcomeSeen: readLegacy("welcome.json", true),
    nearbyButtonUsed: readLegacy("nearby-button.json", true),
    lastSeenRelease:
      changelog && typeof changelog === "object" && "version" in changelog
        ? changelog.version
        : null,
  });
  if (legacyFilesToRemove.length > 0) persist();
  return preferences;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Read a setting or one-time flag outside React, without another disk read. */
export function getPreference<Key extends keyof Preferences>(key: Key): Preferences[Key] {
  return read()[key];
}

export function setPreference<Key extends keyof Preferences>(key: Key, value: Preferences[Key]) {
  const current = read();
  const changed = current[key] !== value;
  if (changed) preferences = { ...current, [key]: value };
  persist();
  if (changed) listeners.forEach((listener) => listener());
}

/** React only rerenders when the selected preference changes. */
export function usePreference<Key extends keyof Preferences>(key: Key): Preferences[Key] {
  return useSyncExternalStore(subscribe, () => getPreference(key));
}
