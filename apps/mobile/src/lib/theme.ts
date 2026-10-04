import { Uniwind } from "uniwind";

import { getPreference, setPreference, type ThemePreference } from "@/lib/preferences";

/**
 * Applies the appearance picked in settings. Called before the first render, so the app
 * doesn't start in the system appearance and then switch.
 */
export function applySavedTheme() {
  Uniwind.setTheme(getPreference("theme"));
}

/** Uniwind also sets the native appearance, so alerts and the keyboard follow. */
export function setThemePreference(theme: ThemePreference) {
  Uniwind.setTheme(theme);
  setPreference("theme", theme);
}
