"use client";

import { useCallback, useState } from "react";

export type StationType = "rail" | "light" | "metro";
export type LayerType = "railwaySurface" | "railwayTunnels";
export type StationVisibility = Record<StationType, boolean>;
export type LayerVisibility = Record<LayerType, boolean>;

export interface MapLayersState {
  stations: StationVisibility;
  layers: LayerVisibility;
}

const STORAGE_KEY = "map-layers";
const DEFAULT_STATE: MapLayersState = {
  stations: { rail: true, light: true, metro: true },
  layers: { railwaySurface: true, railwayTunnels: true },
};

function loadState(): MapLayersState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_STATE;
    const parsed = JSON.parse(stored);
    return {
      stations: { ...DEFAULT_STATE.stations, ...parsed.stations },
      layers: { ...DEFAULT_STATE.layers, ...parsed.layers },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state: MapLayersState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore localStorage errors
  }
}

export function useMapLayers() {
  const [state, setState] = useState<MapLayersState>(loadState);

  const toggleStation = useCallback((type: StationType) => {
    setState((prev) => {
      const next = { ...prev, stations: { ...prev.stations, [type]: !prev.stations[type] } };
      saveState(next);
      return next;
    });
  }, []);

  const toggleLayer = useCallback((type: LayerType) => {
    setState((prev) => {
      const next = { ...prev, layers: { ...prev.layers, [type]: !prev.layers[type] } };
      saveState(next);
      return next;
    });
  }, []);

  return { stations: state.stations, layers: state.layers, toggleStation, toggleLayer };
}
