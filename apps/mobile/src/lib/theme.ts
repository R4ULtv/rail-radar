import { File, Paths } from "expo-file-system";
import { Uniwind, useUniwind } from "uniwind";

export type ThemePreference = "system" | "light" | "dark";

const file = new File(Paths.document, "theme.json");

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * Applies the appearance picked in settings. Called before the first render, so the app
 * doesn't start in the system appearance and then switch.
 */
export function applySavedTheme() {
  try {
    const saved: unknown = file.exists ? JSON.parse(file.textSync()) : null;
    if (isThemePreference(saved) && saved !== "system") Uniwind.setTheme(saved);
  } catch {
    // Keep the system appearance.
  }
}

/** Uniwind also sets the native appearance, so alerts and the keyboard follow. */
export function setThemePreference(theme: ThemePreference) {
  Uniwind.setTheme(theme);
  try {
    if (!file.exists) file.create();
    file.write(JSON.stringify(theme));
  } catch {
    // The appearance still changes; it's only lost on the next launch.
  }
}

export function useThemePreference(): ThemePreference {
  const { theme, hasAdaptiveThemes } = useUniwind();
  return hasAdaptiveThemes ? "system" : theme;
}
