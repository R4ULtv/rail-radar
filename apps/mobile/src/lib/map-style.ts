import { File, Paths } from "expo-file-system";
import { useSyncExternalStore } from "react";

/** The muted map the app opens with, or Mapbox's detailed street map. */
export type MapStyle = "simple" | "streets";

export const mapStyles: MapStyle[] = ["simple", "streets"];

const file = new File(Paths.document, "map-style.json");
const listeners = new Set<() => void>();
let mapStyle: MapStyle | null = null;

function read(): MapStyle {
  if (mapStyle) return mapStyle;
  try {
    const saved: unknown = file.exists ? JSON.parse(file.textSync()) : null;
    mapStyle = mapStyles.find((style) => style === saved) ?? "simple";
  } catch {
    mapStyle = "simple";
  }
  return mapStyle;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setMapStyle(next: MapStyle) {
  mapStyle = next;
  listeners.forEach((listener) => listener());
  try {
    if (!file.exists) file.create();
    file.write(JSON.stringify(next));
  } catch {
    // The map still changes; it's only lost on the next launch.
  }
}

export function useMapStyle(): MapStyle {
  return useSyncExternalStore(subscribe, read);
}
