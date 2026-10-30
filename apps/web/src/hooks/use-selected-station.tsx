"use client";

import * as React from "react";
import { useMap } from "react-map-gl/mapbox";
import type { Station } from "@repo/data";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import { useSavedStations } from "./use-saved-stations";
import { useRecentStations } from "./use-recent-stations";
import { useHomeSearch } from "./use-home-search";
import { STATIONS_SOURCE_ID, stationFromFeature } from "@/lib/station-features";

interface SelectedStationContextValue {
  selectedStation: Station | null;
  selectStation: (station: Station) => void;
  clearStation: () => void;
  savedStations: Station[];
  recentStations: Station[];
  isSaved: (stationId: string) => boolean;
  toggleSaved: (station: Station) => void;
  maxSaved: number;
}

const SelectedStationContext = React.createContext<SelectedStationContextValue | null>(null);

export function SelectedStationProvider({ children }: { children: React.ReactNode }) {
  const { current: map } = useMap();
  const { search, setSearch } = useHomeSearch();
  const stationId = search.station ?? null;
  const setStationId = React.useCallback(
    (value: string | null) => setSearch({ station: value }, false),
    [setSearch],
  );

  const isMobile = useIsMobile();

  const { savedStations, isSaved, toggleSaved, maxSaved } = useSavedStations();
  const { recentStations, addRecentStation } = useRecentStations();

  const [stationObject, setStationObject] = React.useState<Station | null>(null);

  const stationRef = React.useRef<Station | null>(null);

  const flyToRef = React.useRef((_geo: { lat: number; lng: number }, _withPanel: boolean) => {});
  React.useEffect(() => {
    flyToRef.current = (geo, withPanel) => {
      map?.flyTo({
        center: [geo.lng, geo.lat],
        zoom: 14,
        padding: isMobile && withPanel ? { bottom: 250, top: 0, left: 0, right: 0 } : undefined,
      });
    };
  }, [map, isMobile]);

  // The ?station= the page was opened with, until the map's stations can resolve it.
  const [linkedStationId, setLinkedStationId] = React.useState(stationId);

  // Clear a stale ?station= param (one no longer backed by a selection)
  React.useEffect(() => {
    if (stationId && !stationRef.current && stationId !== linkedStationId) {
      setStationId(null);
    }
  }, [stationId, linkedStationId, setStationId]);

  const selectStation = React.useCallback(
    (station: Station) => {
      addRecentStation(station);

      // Freight yards have no panel: the map only centers on them.
      if (station.type === "freight") {
        stationRef.current = null;
        setStationObject(null);
        setStationId(null);
        if (station.geo) flyToRef.current(station.geo, false);
        return;
      }

      stationRef.current = station;
      setStationObject(station);
      setStationId(station.id);

      // Metro and light rail stations frame their lines instead (StationLinesMap).
      if (station.geo && station.type === "rail") {
        flyToRef.current(station.geo, true);
      }
    },
    [setStationId, addRecentStation],
  );

  // Links to a station on the map (line pages, a station page's "Back to map") open its
  // view with `lat`/`lng`/`zoom`, so the station is among the features the map loads
  // first. A station outside the opening view isn't loaded, and its param is dropped.
  React.useEffect(() => {
    if (!linkedStationId || !map) return;
    const resolve = () => {
      if (!map.getSource(STATIONS_SOURCE_ID) || !map.isSourceLoaded(STATIONS_SOURCE_ID)) return;
      map.off("idle", resolve);
      const [feature] = map.querySourceFeatures(STATIONS_SOURCE_ID, {
        filter: ["==", ["get", "id"], linkedStationId],
      });
      const station = feature && stationFromFeature(feature);
      if (station && !stationRef.current) selectStation(station);
      setLinkedStationId(null);
    };
    map.on("idle", resolve);
    resolve();
    return () => {
      map.off("idle", resolve);
    };
  }, [linkedStationId, map, selectStation]);

  const clearStation = React.useCallback(() => {
    stationRef.current = null;
    setStationId(null);
    setStationObject(null);
  }, [setStationId]);

  return (
    <SelectedStationContext.Provider
      value={{
        selectedStation: stationObject,
        selectStation,
        clearStation,
        savedStations,
        recentStations,
        isSaved,
        toggleSaved,
        maxSaved,
      }}
    >
      {children}
    </SelectedStationContext.Provider>
  );
}

export function useSelectedStation() {
  const context = React.use(SelectedStationContext);
  if (!context) {
    throw new Error("useSelectedStation must be used within a SelectedStationProvider");
  }
  return context;
}
