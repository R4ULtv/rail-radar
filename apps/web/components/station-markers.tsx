"use client";

import type { MapMouseEvent } from "mapbox-gl";
import { useEffect, useMemo } from "react";
import { Layer, Source, useMap } from "react-map-gl/mapbox";
import type { LayerProps } from "react-map-gl/mapbox";

type Visibility = "visible" | "none";
import { useSelectedStation } from "@/hooks/use-selected-station";
import type { MapLayersState } from "@/hooks/use-map-layers";

const RAIL_LAYER_ID = "rail-stations";
const RAIL_ICON_ID = "rail-icon";
const METRO_ICON_ID = "metro-icon";
const LIGHT_ICON_ID = "light-icon";

const RAIL_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 512 512">
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

const LIGHT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 512 512">
  <rect width="464" height="464" x="24" y="24" fill="#14b8a6" stroke="#fff" stroke-opacity="100%" stroke-width="48" paint-order="stroke" rx="112"/>
  <svg xmlns="http://www.w3.org/2000/svg" width="352" height="352" x="80" y="80" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" alignment-baseline="middle" viewBox="0 0 24 24">
  <rect width="16" height="16" x="4" y="3" rx="2"></rect><path d="M4 11h16"></path><path d="M12 3v8"></path><path d="m8 19-2 3"></path><path d="m18 22-2-3"></path><path d="M8 15h.01"></path><path d="M16 15h.01"></path>
  </svg>
</svg>`;

/** Derive minzoom from importance + type as a Mapbox expression */
const MINZOOM_EXPR = [
  "match",
  ["get", "type"],
  "metro",
  13,
  "light",
  ["match", ["get", "importance"], 3, 11, 13],
  /* rail */ ["match", ["get", "importance"], 1, 3, 2, 7, 3, 9, 11],
];
const MINZOOM_FILTER = ["<=", MINZOOM_EXPR, ["zoom"]];
const LABEL_MINZOOM_FILTER = ["<=", ["+", MINZOOM_EXPR, 2], ["zoom"]];

const metroLayerStyle = (v: Visibility): LayerProps => ({
  id: "metro-stations",
  type: "symbol",
  source: "stations-source",
  filter: ["all", ["==", ["get", "type"], "metro"], MINZOOM_FILTER],
  layout: {
    visibility: v,
    "icon-image": METRO_ICON_ID,
    "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.25, 16, 0.35],
    "icon-allow-overlap": false,
    "icon-anchor": "center",
  },
});

const metroLabelStyle = (v: Visibility): LayerProps => ({
  id: "metro-labels",
  type: "symbol",
  source: "stations-source",
  filter: ["all", ["==", ["get", "type"], "metro"], LABEL_MINZOOM_FILTER],
  layout: {
    visibility: v,
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
});

const lightLayerStyle = (v: Visibility): LayerProps => ({
  id: "light-stations",
  type: "symbol",
  source: "stations-source",
  filter: ["all", ["==", ["get", "type"], "light"], MINZOOM_FILTER],
  layout: {
    visibility: v,
    "icon-image": LIGHT_ICON_ID,
    "icon-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      11,
      ["match", ["get", "importance"], 3, 0.25, 0.2],
      14,
      ["match", ["get", "importance"], 3, 0.3, 0.25],
      16,
      ["match", ["get", "importance"], 3, 0.35, 0.3],
    ],
    "icon-allow-overlap": false,
    "icon-anchor": "center",
    "symbol-sort-key": ["get", "importance"],
  },
});

const lightLabelStyle = (v: Visibility): LayerProps => ({
  id: "light-labels",
  type: "symbol",
  source: "stations-source",
  filter: ["all", ["==", ["get", "type"], "light"], LABEL_MINZOOM_FILTER],
  layout: {
    visibility: v,
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
});

const railLayerStyle = (v: Visibility): LayerProps => ({
  id: RAIL_LAYER_ID,
  type: "symbol",
  source: "stations-source",
  filter: ["all", ["==", ["get", "type"], "rail"], MINZOOM_FILTER],
  layout: {
    visibility: v,
    "icon-image": RAIL_ICON_ID,
    "icon-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      3,
      ["match", ["get", "importance"], 1, 0.3, 2, 0.25, 0.2],
      10,
      ["match", ["get", "importance"], 1, 0.35, 2, 0.32, 0.3],
      13,
      ["match", ["get", "importance"], 1, 0.4, 2, 0.37, 0.35],
    ],
    "icon-allow-overlap": false,
    "icon-anchor": "center",
    "symbol-sort-key": ["get", "importance"],
  },
});

const railLabelStyle = (v: Visibility): LayerProps => ({
  id: "rail-labels",
  type: "symbol",
  source: "stations-source",
  filter: ["all", ["==", ["get", "type"], "rail"], LABEL_MINZOOM_FILTER],
  layout: {
    visibility: v,
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
});

const railwayLineStyle = (v: Visibility): LayerProps => ({
  id: "railway-lines",
  type: "line",
  source: "composite",
  "source-layer": "road",
  filter: [
    "all",
    ["==", ["get", "class"], "major_rail"],
    ["match", ["get", "structure"], ["none", "ford"], true, false],
  ],
  layout: { visibility: v },
  paint: {
    "line-color": "#4B61D1",
    "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 10, 1, 14, 2],
    "line-opacity": 0.6,
  },
});

const railwayBridgeStyle = (v: Visibility): LayerProps => ({
  id: "railway-lines-bridge",
  type: "line",
  source: "composite",
  "source-layer": "road",
  filter: ["all", ["==", ["get", "structure"], "bridge"], ["==", ["get", "class"], "major_rail"]],
  layout: { visibility: v },
  paint: {
    "line-color": "#4B61D1",
    "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 10, 1, 14, 2],
    "line-opacity": 0.6,
  },
});

const railwayTunnelStyle = (v: Visibility): LayerProps => ({
  id: "railway-lines-tunnel",
  type: "line",
  source: "composite",
  "source-layer": "road",
  filter: ["all", ["==", ["get", "structure"], "tunnel"], ["==", ["get", "class"], "major_rail"]],
  layout: { visibility: v },
  paint: {
    "line-color": "#4B61D1",
    "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 10, 1, 14, 2],
    "line-opacity": 0.4,
    "line-dasharray": [2, 2],
  },
});

export function StationMarkers({ stations, layers }: Pick<MapLayersState, "stations" | "layers">) {
  const { current: map } = useMap();
  const { selectStation } = useSelectedStation();

  const railVis = stations.rail ? "visible" : ("none" as const);
  const lightVis = stations.light ? "visible" : ("none" as const);
  const metroVis = stations.metro ? "visible" : ("none" as const);
  const surfaceVis = layers.railwaySurface ? "visible" : ("none" as const);
  const tunnelVis = layers.railwayTunnels ? "visible" : ("none" as const);

  const railLayer = useMemo(() => railLayerStyle(railVis), [railVis]);
  const railLabel = useMemo(() => railLabelStyle(railVis), [railVis]);
  const metroLayer = useMemo(() => metroLayerStyle(metroVis), [metroVis]);
  const metroLabel = useMemo(() => metroLabelStyle(metroVis), [metroVis]);
  const lightLayer = useMemo(() => lightLayerStyle(lightVis), [lightVis]);
  const lightLabel = useMemo(() => lightLabelStyle(lightVis), [lightVis]);
  const tunnelLayer = useMemo(() => railwayTunnelStyle(tunnelVis), [tunnelVis]);
  const lineLayer = useMemo(() => railwayLineStyle(surfaceVis), [surfaceVis]);
  const bridgeLayer = useMemo(() => railwayBridgeStyle(surfaceVis), [surfaceVis]);

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

    loadIcon(RAIL_ICON_ID, RAIL_ICON_SVG);
    loadIcon(METRO_ICON_ID, METRO_ICON_SVG);
    loadIcon(LIGHT_ICON_ID, LIGHT_ICON_SVG);

    const handleClick = (e: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
      const feature = e.features?.[0];
      if (!feature?.properties || !feature.geometry) return;

      const id = feature.properties.id as string | undefined;
      const name = feature.properties.name as string | undefined;
      const type = feature.properties.type as "rail" | "metro" | "light";

      if (id === undefined || name === undefined) return;

      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      const importance = (feature.properties.importance ?? 4) as 1 | 2 | 3 | 4;
      selectStation({ id, name, type, importance, geo: { lat: lat!, lng: lng! } });
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    const METRO_LAYER_ID = "metro-stations";
    const LIGHT_LAYER_ID = "light-stations";

    map.on("click", RAIL_LAYER_ID, handleClick);
    map.on("mouseenter", RAIL_LAYER_ID, handleMouseEnter);
    map.on("mouseleave", RAIL_LAYER_ID, handleMouseLeave);
    map.on("click", METRO_LAYER_ID, handleClick);
    map.on("mouseenter", METRO_LAYER_ID, handleMouseEnter);
    map.on("mouseleave", METRO_LAYER_ID, handleMouseLeave);
    map.on("click", LIGHT_LAYER_ID, handleClick);
    map.on("mouseenter", LIGHT_LAYER_ID, handleMouseEnter);
    map.on("mouseleave", LIGHT_LAYER_ID, handleMouseLeave);

    return () => {
      map.off("click", RAIL_LAYER_ID, handleClick);
      map.off("mouseenter", RAIL_LAYER_ID, handleMouseEnter);
      map.off("mouseleave", RAIL_LAYER_ID, handleMouseLeave);
      map.off("click", METRO_LAYER_ID, handleClick);
      map.off("mouseenter", METRO_LAYER_ID, handleMouseEnter);
      map.off("mouseleave", METRO_LAYER_ID, handleMouseLeave);
      map.off("click", LIGHT_LAYER_ID, handleClick);
      map.off("mouseenter", LIGHT_LAYER_ID, handleMouseEnter);
      map.off("mouseleave", LIGHT_LAYER_ID, handleMouseLeave);
    };
  }, [map, selectStation]);

  return (
    <>
      {/* Railway tracks */}
      <Layer {...tunnelLayer} />
      <Layer {...lineLayer} />
      <Layer {...bridgeLayer} />

      <Source
        id="stations-source"
        type="geojson"
        data={`${process.env.NEXT_PUBLIC_API_URL}/stations.geojson`}
      >
        <Layer {...metroLayer} />
        <Layer {...metroLabel} />
        <Layer {...lightLayer} />
        <Layer {...lightLabel} />
        <Layer {...railLayer} />
        <Layer {...railLabel} />
      </Source>
    </>
  );
}
