"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Layer,
  Source,
  useMap,
  type LayerProps,
  type MapRef,
  type MarkerDragEvent,
} from "react-map-gl/maplibre";
import type { Station } from "@repo/data";
import type { MapLayerMouseEvent } from "maplibre-gl";

const MapGL = dynamic(
  () => import("react-map-gl/maplibre").then((mod) => mod.Map),
  { ssr: false },
);

const Marker = dynamic(
  () => import("react-map-gl/maplibre").then((mod) => mod.Marker),
  { ssr: false },
);

const LAYER_ID = "stations-layer";
const SOURCE_ID = "stations-source";

const STATION_COLORS: Record<string, string> = {
  rail: "#4B61D1",
  metro: "#f22a18",
  light: "#14b8a6",
};

const stationLayerStyle: LayerProps = {
  id: LAYER_ID,
  type: "circle",
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 10, 6, 15, 8],
    "circle-color": [
      "match",
      ["get", "type"],
      "rail",
      "#4B61D1",
      "metro",
      "#f22a18",
      "light",
      "#14b8a6",
      "#4B61D1", // default
    ],
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1.5,
  },
};

// Railway track styles (OpenMapTiles schema used by StadiaMaps)
const railwayLineStyle: LayerProps = {
  id: "railway-lines",
  type: "line",
  source: "openmaptiles",
  "source-layer": "transportation",
  filter: [
    "all",
    ["==", ["get", "class"], "rail"],
    ["!=", ["get", "brunnel"], "tunnel"],
  ],
  paint: {
    "line-color": "#4B61D1",
    "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 10, 1, 14, 2],
    "line-opacity": 0.6,
  },
};

const railwayTunnelStyle: LayerProps = {
  id: "railway-lines-tunnel",
  type: "line",
  source: "openmaptiles",
  "source-layer": "transportation",
  filter: [
    "all",
    ["==", ["get", "class"], "rail"],
    ["==", ["get", "brunnel"], "tunnel"],
  ],
  paint: {
    "line-color": "#4B61D1",
    "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 10, 1, 14, 2],
    "line-opacity": 0.4,
    "line-dasharray": [2, 2],
  },
};

const DEFAULT_VIEW = {
  lat: 42.5,
  lng: 12.5,
  zoom: 5,
};

interface StationMapProps {
  stations: Station[];
  selectedStationId: string | null;
  isAddingStation: boolean;
  onSelectStation: (id: string) => void;
  onMarkerDragEnd: (id: string, lat: number, lng: number) => void;
  onMapClick: (lat: number, lng: number) => void;
  onSetStationLocation?: (lat: number, lng: number) => void;
}

interface StationLayersProps {
  stations: Station[];
  selectedStationId: string | null;
  onSelectStation: (id: string) => void;
}

function StationLayers({
  stations,
  selectedStationId,
  onSelectStation,
}: StationLayersProps) {
  const { current: map } = useMap();

  // Build GeoJSON from non-selected stations
  const geojson = useMemo(() => {
    const features = stations
      .filter((s) => s.geo && s.id !== selectedStationId)
      .map((station) => ({
        type: "Feature" as const,
        properties: { id: station.id, type: station.type },
        geometry: {
          type: "Point" as const,
          coordinates: [station.geo!.lng, station.geo!.lat],
        },
      }));

    return {
      type: "FeatureCollection" as const,
      features,
    };
  }, [stations, selectedStationId]);

  // Handle click on layer markers
  useEffect(() => {
    if (!map) return;

    const handleClick = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (feature?.properties?.id) {
        onSelectStation(feature.properties.id as string);
      }
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", LAYER_ID, handleClick);
    map.on("mouseenter", LAYER_ID, handleMouseEnter);
    map.on("mouseleave", LAYER_ID, handleMouseLeave);

    return () => {
      map.off("click", LAYER_ID, handleClick);
      map.off("mouseenter", LAYER_ID, handleMouseEnter);
      map.off("mouseleave", LAYER_ID, handleMouseLeave);
    };
  }, [map, onSelectStation]);

  return (
    <>
      {/* Railway tracks */}
      <Layer {...railwayTunnelStyle} />
      <Layer {...railwayLineStyle} />

      <Source id={SOURCE_ID} type="geojson" data={geojson}>
        <Layer {...stationLayerStyle} />
      </Source>
    </>
  );
}

export function StationMap({
  stations,
  selectedStationId,
  isAddingStation,
  onSelectStation,
  onMarkerDragEnd,
  onMapClick,
  onSetStationLocation,
}: StationMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Check if we're placing a station (selected station without coordinates)
  const selectedStation = selectedStationId
    ? stations.find((s) => s.id === selectedStationId)
    : null;
  const isPlacingStation = selectedStation && !selectedStation.geo;

  // Center map on selected station
  useEffect(() => {
    if (!mapRef.current || !selectedStationId) return;
    const station = stations.find((s) => s.id === selectedStationId);
    if (!station?.geo) return;

    mapRef.current.flyTo({
      center: [station.geo.lng, station.geo.lat],
      zoom: Math.max(mapRef.current.getZoom(), 14),
      duration: 500,
    });
  }, [selectedStationId, stations]);

  const handleMapClick = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      const lat = Math.round(e.lngLat.lat * 1e6) / 1e6;
      const lng = Math.round(e.lngLat.lng * 1e6) / 1e6;

      if (isAddingStation) {
        onMapClick(lat, lng);
      } else if (isPlacingStation && onSetStationLocation) {
        onSetStationLocation(lat, lng);
      }
    },
    [isAddingStation, isPlacingStation, onMapClick, onSetStationLocation],
  );

  const handleDragEnd = useCallback(
    (e: MarkerDragEvent) => {
      if (selectedStationId) {
        const lat = Math.round(e.lngLat.lat * 1e6) / 1e6;
        const lng = Math.round(e.lngLat.lng * 1e6) / 1e6;
        onMarkerDragEnd(selectedStationId, lat, lng);
      }
    },
    [selectedStationId, onMarkerDragEnd],
  );

  // Determine if we should show crosshair cursor
  const showCrosshair = isAddingStation || isPlacingStation;

  return (
    <div className="relative h-full w-full">
      <MapGL
        ref={mapRef}
        initialViewState={{
          latitude: DEFAULT_VIEW.lat,
          longitude: DEFAULT_VIEW.lng,
          zoom: DEFAULT_VIEW.zoom,
          bearing: 0,
          pitch: 0,
        }}
        onLoad={() => setIsMapLoaded(true)}
        onClick={handleMapClick}
        cursor={showCrosshair ? "crosshair" : undefined}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://tiles-eu.stadiamaps.com/styles/alidade_smooth_dark.json"
        maxPitch={0}
        minZoom={1}
        maxZoom={18}
        interactiveLayerIds={[LAYER_ID]}
      >
        {isMapLoaded && (
          <>
            <StationLayers
              stations={stations}
              selectedStationId={selectedStationId}
              onSelectStation={onSelectStation}
            />
            {selectedStation?.geo && (
              <Marker
                latitude={selectedStation.geo.lat}
                longitude={selectedStation.geo.lng}
                anchor="center"
                draggable
                onDragEnd={handleDragEnd}
              >
                <div
                  className="size-5 cursor-grab rounded-full border-2 border-white active:cursor-grabbing"
                  style={{
                    backgroundColor:
                      STATION_COLORS[selectedStation.type] ?? STATION_COLORS.rail,
                  }}
                />
              </Marker>
            )}
          </>
        )}
      </MapGL>

      {(isAddingStation || isPlacingStation) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-md bg-black/70 px-4 py-2 text-sm text-white">
            {isAddingStation
              ? "Click on the map to place the new station"
              : "Click on the map to set location"}
          </div>
        </div>
      )}
    </div>
  );
}
