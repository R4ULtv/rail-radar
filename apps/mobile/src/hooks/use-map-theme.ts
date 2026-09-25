import { useUniwind } from "uniwind";

// Muted Mapbox styles in both modes, so the railway lines and station icons stay prominent.
const mapThemes = {
  light: {
    styleURL: "mapbox://styles/mapbox/light-v11",
    labelColor: "#0c0a09",
    labelHaloColor: "rgba(255,255,255,0.8)",
    statusBarStyle: "dark" as const,
  },
  dark: {
    styleURL: "mapbox://styles/mapbox/dark-v11",
    labelColor: "#ffffff",
    labelHaloColor: "rgba(0,0,0,0.5)",
    statusBarStyle: "light" as const,
  },
};

/**
 * Map style, station label colors and status bar style for the app theme. It reads Uniwind's
 * theme rather than React Native's color scheme, which can disagree with it, so the map always
 * matches the UI.
 */
export function useMapTheme() {
  return mapThemes[useUniwind().theme === "light" ? "light" : "dark"];
}
