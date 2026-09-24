import { useColorScheme } from "react-native";

// Muted Mapbox styles in both modes, so the railway lines and station icons stay prominent.
const mapThemes = {
  light: {
    styleURL: "mapbox://styles/mapbox/light-v11",
    labelColor: "#0c0a09",
    labelHaloColor: "rgba(255,255,255,0.8)",
  },
  dark: {
    styleURL: "mapbox://styles/mapbox/dark-v11",
    labelColor: "#ffffff",
    labelHaloColor: "rgba(0,0,0,0.5)",
  },
};

/** Map style and station label colors for the system appearance, like the app theme. */
export function useMapTheme() {
  return mapThemes[useColorScheme() === "light" ? "light" : "dark"];
}
