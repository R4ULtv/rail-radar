import type { Station, StationFeatureCollection } from "@repo/data";
import { get, writable } from "svelte/store";
import {
  applyStationUpdates,
  geojsonToStations,
  normalizeNewStation,
  stationsToGeojson,
  validateGeojson,
  type StationUpdates,
} from "$lib/stations";

export type DataMode = "local" | "browser";

interface StationState {
  stations: Station[];
  sourceGeojson: StationFeatureCollection | null;
  mode: DataMode;
  isLoading: boolean;
  error: string | null;
  fileName: string | null;
}

const initialState: StationState = {
  stations: [],
  sourceGeojson: null,
  mode: "browser",
  isLoading: true,
  error: null,
  fileName: null,
};

function sortStations(stations: Station[]): Station[] {
  return [...stations].sort((a, b) => a.name.localeCompare(b.name));
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json();
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

function createStationStore() {
  const store = writable<StationState>(initialState);

  return {
    subscribe: store.subscribe,
    async initialize(options?: { mode?: DataMode }) {
      store.update((state) => ({ ...state, isLoading: true, error: null }));
      const mode = options?.mode ?? "browser";

      if (mode === "browser") {
        store.set({
          ...initialState,
          isLoading: false,
          error: null,
          fileName: null,
        });
        return;
      }

      try {
        const response = await fetch("/api/stations");
        if (!response.ok) throw new Error(await readApiError(response, "Local API unavailable"));

        const stations: Station[] = await response.json();
        store.set({
          stations,
          sourceGeojson: null,
          mode: "local",
          isLoading: false,
          error: null,
          fileName: "packages/data/src/stations.geojson",
        });
      } catch (error) {
        store.set({
          stations: [],
          sourceGeojson: null,
          mode: "local",
          isLoading: false,
          error: error instanceof Error ? error.message : "Local station file API unavailable",
          fileName: "packages/data/src/stations.geojson",
        });
      }
    },
    async loadUploadedFile(file: File) {
      try {
        const text = await file.text();
        const geojson = validateGeojson(JSON.parse(text));
        store.set({
          stations: geojsonToStations(geojson),
          sourceGeojson: geojson,
          mode: "browser",
          isLoading: false,
          error: null,
          fileName: file.name,
        });
      } catch (error) {
        store.update((state) => ({
          ...state,
          error: error instanceof Error ? error.message : "Failed to read GeoJSON file",
        }));
      }
    },
    exportGeojson() {
      const state = get(store);
      const geojson = stationsToGeojson(state.stations);
      const blob = new Blob([JSON.stringify(geojson)], { type: "application/geo+json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = state.fileName ?? "stations.geojson";
      link.click();
      URL.revokeObjectURL(url);
    },
    async createStation(
      name: string,
      geo: { lat: number; lng: number },
      options?: { id?: string; type?: "rail" | "metro" | "light"; importance?: 1 | 2 | 3 | 4 },
    ): Promise<Station> {
      const state = get(store);
      const { id, type, importance } = options ?? {};

      if (id && state.stations.some((station) => station.id === id)) {
        throw new Error(`Station ID "${id}" already exists`);
      }

      if (state.mode === "local") {
        const response = await fetch("/api/stations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, name, geo, type, importance }),
        });
        if (!response.ok) throw new Error(await readApiError(response, "Failed to create station"));
        const station: Station = await response.json();
        store.update((current) => ({
          ...current,
          stations: sortStations([...current.stations, station]),
        }));
        return station;
      }

      const station = normalizeNewStation({ id, name, geo, type, importance });
      store.update((current) => ({
        ...current,
        stations: sortStations([...current.stations, station]),
      }));
      return station;
    },
    async updateStation(id: string, updates: StationUpdates): Promise<Station> {
      const state = get(store);
      const existing = state.stations.find((station) => station.id === id);
      if (!existing) throw new Error("Station not found");

      if (state.mode === "local") {
        const response = await fetch(`/api/stations/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!response.ok) throw new Error(await readApiError(response, "Failed to update station"));
        const station: Station = await response.json();
        store.update((current) => ({
          ...current,
          stations: sortStations(current.stations.map((item) => (item.id === id ? station : item))),
        }));
        return station;
      }

      const station = applyStationUpdates(existing, updates);
      store.update((current) => ({
        ...current,
        stations: sortStations(current.stations.map((item) => (item.id === id ? station : item))),
      }));
      return station;
    },
    async restoreStation(station: Station): Promise<Station> {
      const state = get(store);

      if (state.mode === "local") {
        const response = await fetch("/api/stations/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(station),
        });
        if (!response.ok)
          throw new Error(await readApiError(response, "Failed to restore station"));
      }

      store.update((current) => {
        const without = current.stations.filter((item) => item.id !== station.id);
        return { ...current, stations: sortStations([...without, station]) };
      });
      return station;
    },
    async deleteStation(id: string): Promise<Station> {
      const state = get(store);
      const existing = state.stations.find((station) => station.id === id);
      if (!existing) throw new Error("Station not found");

      if (state.mode === "local") {
        const response = await fetch(`/api/stations/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error(await readApiError(response, "Failed to delete station"));
        const station: Station = await response.json();
        store.update((current) => ({
          ...current,
          stations: current.stations.filter((item) => item.id !== id),
        }));
        return station;
      }

      store.update((current) => ({
        ...current,
        stations: current.stations.filter((item) => item.id !== id),
      }));
      return existing;
    },
  };
}

export const stationStore = createStationStore();
