import { useUniwind } from "uniwind";

import { useMapStyle } from "@/lib/map-style";

// Muted Mapbox styles in both modes, so the railway lines and station icons stay prominent.
const simpleStyleURLs = {
  light: "mapbox://styles/mapbox/light-v11",
  dark: "mapbox://styles/mapbox/dark-v11",
};
// Mapbox Standard, the street map, has a day and a night light preset instead of two styles.
const streetsStyleURL = "mapbox://styles/mapbox/standard";

const appearances = {
  light: {
    lightPreset: "day" as const,
    labelColor: "#0c0a09",
    labelHaloColor: "rgba(255,255,255,0.8)",
    statusBarStyle: "dark" as const,
  },
  dark: {
    lightPreset: "night" as const,
    labelColor: "#ffffff",
    labelHaloColor: "rgba(0,0,0,0.5)",
    statusBarStyle: "light" as const,
  },
};

/**
 * Map style, station label colors and status bar style for the app theme and the map picked
 * in the map sheet. It reads Uniwind's theme rather than React Native's color scheme, which can
 * disagree with it, so the map always matches the UI.
 */
export function useMapTheme() {
  const theme = useUniwind().theme === "light" ? "light" : "dark";
  const isStreets = useMapStyle() === "streets";
  return {
    ...appearances[theme],
    isStreets,
    styleURL: isStreets ? streetsStyleURL : simpleStyleURLs[theme],
  };
}
