"use client";

import type { MapMouseEvent } from "mapbox-gl";
import { useEffect, useMemo } from "react";
import { Layer, Source, useMap } from "react-map-gl/mapbox";
import type { LayerProps } from "react-map-gl/mapbox";
import { stations } from "@repo/data/stations";
import { useSelectedStation } from "@/hooks/use-selected-station";

const LAYER_ID = "stations";
const ICON_ID = "station-icon";
const METRO_ICON_ID = "metro-icon";

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 512 512">
  <rect width="464" height="464" x="24" y="24" fill="#4b61d1" stroke="#fff" stroke-opacity="100%" stroke-width="48" paint-order="stroke" rx="112"/>
  <svg xmlns="http://www.w3.org/2000/svg" width="352" height="352" x="80" y="80" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" alignment-baseline="middle" viewBox="0 0 24 24">
    <path d="M8 3.1V7a4 4 0 0 0 8 0V3.1M9 15l-1-1m7 1 1-1"/>
    <path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Zm-1 0-2 3m10-3 2 3"/>
  </svg>
</svg>`;

const METRO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 512 512">
  <rect width="464" height="464" x="24" y="24" fill="#f22a18" stroke="#fff" stroke-opacity="100%" stroke-width="48" paint-order="stroke" rx="112"/>
  <svg xmlns="http://www.w3.org/2000/svg" width="452" height="452" x="30" y="30" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" alignment-baseline="middle" viewBox="0 0 24 24">
    <path d="M8 16V8.5a.5.5 0 0 1 .9-.3l2.7 3.599a.5.5 0 0 0 .8 0l2.7-3.6a.5.5 0 0 1 .9.3V16"/>
  </svg>
</svg>`;

const metroLayerStyle: LayerProps = {
  id: "metro-stations",
  type: "symbol",
  minzoom: 13,
  layout: {
    "icon-image": METRO_ICON_ID,
    "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.25, 16, 0.35],
    "icon-allow-overlap": false,
    "icon-anchor": "center",
  },
};

const metroLabelStyle: LayerProps = {
  id: "metro-labels",
  type: "symbol",
  minzoom: 14.5,
  layout: {
    "text-field": ["get", "name"],
    "text-size": 12,
    "text-offset": [0, 1.3],
    "text-anchor": "top",
    "text-optional": true,
  },
  paint: {
    "text-color": "#ffffff",
    "text-halo-color": "rgba(0,0,0,0.5)",
    "text-halo-width": 1.5,
    "text-halo-blur": 1,
  },
};

const stationLayerStyle: LayerProps = {
  id: LAYER_ID,
  type: "symbol",
  minzoom: 5,
  filter: [
    "<=",
    ["get", "minzoom"],
    ["zoom"],
  ],
  layout: {
    "icon-image": ICON_ID,
    "icon-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      5, ["match", ["get", "importance"], 1, 0.3, 2, 0.25, 0.2],
      10, ["match", ["get", "importance"], 1, 0.35, 2, 0.32, 0.3],
      13, ["match", ["get", "importance"], 1, 0.4, 2, 0.37, 0.35],
    ],
    "icon-allow-overlap": false,
    "icon-anchor": "center",
    "symbol-sort-key": ["get", "importance"],
  },
};

const stationLabelStyle: LayerProps = {
  id: "station-labels",
  type: "symbol",
  minzoom: 5,
  filter: [
    "<=",
    ["+", ["get", "minzoom"], 2],
    ["zoom"],
  ],
  layout: {
    "text-field": ["get", "name"],
    "text-size": 13,
    "text-offset": [0, 1.3],
    "text-anchor": "top",
    "text-optional": true,
  },
  paint: {
    "text-color": "#ffffff",
    "text-halo-color": "rgba(0,0,0,0.5)",
    "text-halo-width": 1.5,
    "text-halo-blur": 1,
  },
};

const railwayLineStyle: LayerProps = {
  id: "railway-lines",
  type: "line",
  source: "composite",
  "source-layer": "road",
  filter: [
    "all",
    ["==", ["get", "class"], "major_rail"],
    ["match", ["get", "structure"], ["none", "ford"], true, false],
  ],
  paint: {
    "line-color": "#4B61D1",
    "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 10, 1, 14, 2],
    "line-opacity": 0.6,
  },
};

const railwayBridgeStyle: LayerProps = {
  id: "railway-lines-bridge",
  type: "line",
  source: "composite",
  "source-layer": "road",
  filter: [
    "all",
    ["==", ["get", "structure"], "bridge"],
    ["==", ["get", "class"], "major_rail"],
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
  source: "composite",
  "source-layer": "road",
  filter: [
    "all",
    ["==", ["get", "structure"], "tunnel"],
    ["==", ["get", "class"], "major_rail"],
  ],
  paint: {
    "line-color": "#4B61D1",
    "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 10, 1, 14, 2],
    "line-opacity": 0.4,
    "line-dasharray": [2, 2],
  },
};

const IMPORTANCE_MINZOOM: Record<number, number> = { 1: 5, 2: 7, 3: 9, 4: 11 };

function createStationsGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: stations
      .filter((station) => station.type === "rail" && station.geo)
      .map((station) => ({
        type: "Feature" as const,
        properties: {
          id: station.id,
          name: station.name,
          type: station.type,
          importance: station.importance,
          minzoom: IMPORTANCE_MINZOOM[station.importance] ?? 11,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [station.geo!.lng, station.geo!.lat],
        },
      })),
  };
}

function createMetroGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: stations
      .filter((station) => station.type === "metro" && station.geo)
      .map((station) => ({
        type: "Feature" as const,
        properties: {
          id: station.id,
          name: station.name,
          type: station.type,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [station.geo!.lng, station.geo!.lat],
        },
      })),
  };
}

export function StationMarkers() {
  const { current: map } = useMap();
  const { selectStation } = useSelectedStation();

  const geojsonData = useMemo(() => createStationsGeoJSON(), []);
  const metroGeojsonData = useMemo(() => createMetroGeoJSON(), []);

  useEffect(() => {
    if (!map) return;

    const loadIcon = (id: string, svg: string) => {
      if (map.hasImage(id)) return;
      const img = new Image(64, 64);
      img.onload = () => {
        if (!map.hasImage(id)) {
          map.addImage(id, img);
        }
      };
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    };

    loadIcon(ICON_ID, ICON_SVG);
    loadIcon(METRO_ICON_ID, METRO_ICON_SVG);

    const handleClick = (
      e: MapMouseEvent & { features?: GeoJSON.Feature[] },
    ) => {
      const feature = e.features?.[0];
      if (!feature?.properties) return;

      const id = feature.properties.id as string | undefined;
      const name = feature.properties.name as string | undefined;
      const type = feature.properties.type as "rail" | "metro";

      if (id === undefined || name === undefined) return;

      const importance = (feature.properties.importance ?? 4) as 1 | 2 | 3 | 4;
      selectStation({ id, name, type, importance });
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    const METRO_LAYER_ID = "metro-stations";

    map.on("click", LAYER_ID, handleClick);
    map.on("mouseenter", LAYER_ID, handleMouseEnter);
    map.on("mouseleave", LAYER_ID, handleMouseLeave);
    map.on("click", METRO_LAYER_ID, handleClick);
    map.on("mouseenter", METRO_LAYER_ID, handleMouseEnter);
    map.on("mouseleave", METRO_LAYER_ID, handleMouseLeave);

    return () => {
      map.off("click", LAYER_ID, handleClick);
      map.off("mouseenter", LAYER_ID, handleMouseEnter);
      map.off("mouseleave", LAYER_ID, handleMouseLeave);
      map.off("click", METRO_LAYER_ID, handleClick);
      map.off("mouseenter", METRO_LAYER_ID, handleMouseEnter);
      map.off("mouseleave", METRO_LAYER_ID, handleMouseLeave);
    };
  }, [map, selectStation]);

  return (
    <>
      {/* Railway tracks */}
      <Layer {...railwayTunnelStyle} />
      <Layer {...railwayLineStyle} />
      <Layer {...railwayBridgeStyle} />

      <Source id="metro-source" type="geojson" data={metroGeojsonData}>
        <Layer {...metroLayerStyle} />
        <Layer {...metroLabelStyle} />
      </Source>

      <Source id="stations-source" type="geojson" data={geojsonData}>
        <Layer {...stationLayerStyle} />
        <Layer {...stationLabelStyle} />
      </Source>
    </>
  );
}
