"use client";

import type { MapMouseEvent } from "mapbox-gl";
import { useEffect } from "react";
import { Layer, Source, useMap } from "react-map-gl/mapbox";
import type { LayerProps } from "react-map-gl/mapbox";
import { useSelectedStation } from "@/hooks/use-selected-station";
import { env } from "@/lib/env";
import { STATIONS_SOURCE_ID, stationFromFeature } from "@/lib/station-features";
import {
  FREIGHT_KIND_ICON_SVG,
  LIGHT_ICON_SVG,
  METRO_ICON_SVG,
  RAIL_ICON_SVG,
  svgDataUri,
} from "@/lib/station-marker-icons";

const RAIL_LAYER_ID = "rail-stations";
const RAIL_ICON_ID = "rail-icon";
const FREIGHT_LAYER_ID = "freight-stations";
const MARSHALLING_ICON_ID = "freight-marshalling-icon";
const INTERMODAL_ICON_ID = "freight-intermodal-icon";
const PORT_ICON_ID = "freight-port-icon";
const METRO_ICON_ID = "metro-icon";
const LIGHT_ICON_ID = "light-icon";

/** Derive minzoom from importance + type as a Mapbox expression */
const MINZOOM_EXPR = [
  "match",
  ["get", "type"],
  "metro",
  13,
  "light",
  ["match", ["get", "importance"], 3, 11, 13],
  "freight",
  11,
  /* rail */ ["match", ["get", "importance"], 1, 3, 2, 7, 3, 9, 11],
];
const MINZOOM_FILTER = ["<=", MINZOOM_EXPR, ["zoom"]];
const LABEL_MINZOOM_FILTER = ["<=", ["+", MINZOOM_EXPR, 2], ["zoom"]];

const metroLayerStyle = (): LayerProps => ({
  id: "metro-stations",
  type: "symbol",
  source: STATIONS_SOURCE_ID,
  filter: ["all", ["==", ["get", "type"], "metro"], MINZOOM_FILTER],
  layout: {
    "icon-image": METRO_ICON_ID,
    "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.25, 16, 0.35],
    "icon-allow-overlap": false,
    "icon-anchor": "center",
  },
});

const metroLabelStyle = (): LayerProps => ({
  id: "metro-labels",
  type: "symbol",
  source: STATIONS_SOURCE_ID,
  filter: ["all", ["==", ["get", "type"], "metro"], LABEL_MINZOOM_FILTER],
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
});

const lightLayerStyle = (): LayerProps => ({
  id: "light-stations",
  type: "symbol",
  source: STATIONS_SOURCE_ID,
  filter: ["all", ["==", ["get", "type"], "light"], MINZOOM_FILTER],
  layout: {
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

const lightLabelStyle = (): LayerProps => ({
  id: "light-labels",
  type: "symbol",
  source: STATIONS_SOURCE_ID,
  filter: ["all", ["==", ["get", "type"], "light"], LABEL_MINZOOM_FILTER],
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
});

const railLayerStyle = (): LayerProps => ({
  id: RAIL_LAYER_ID,
  type: "symbol",
  source: STATIONS_SOURCE_ID,
  filter: ["all", ["==", ["get", "type"], "rail"], MINZOOM_FILTER],
  layout: {
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

const railLabelStyle = (): LayerProps => ({
  id: "rail-labels",
  type: "symbol",
  source: STATIONS_SOURCE_ID,
  filter: ["all", ["==", ["get", "type"], "rail"], LABEL_MINZOOM_FILTER],
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
});

const freightLayerStyle = (): LayerProps => ({
  id: FREIGHT_LAYER_ID,
  type: "symbol",
  source: STATIONS_SOURCE_ID,
  filter: ["all", ["==", ["get", "type"], "freight"], MINZOOM_FILTER],
  layout: {
    "icon-image": [
      "match",
      ["get", "kind"],
      "marshalling",
      MARSHALLING_ICON_ID,
      "port",
      PORT_ICON_ID,
      INTERMODAL_ICON_ID,
    ],
    "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.25, 14, 0.3, 16, 0.35],
    "icon-allow-overlap": false,
    "icon-anchor": "center",
    "symbol-sort-key": ["get", "importance"],
  },
});

const freightLabelStyle = (): LayerProps => ({
  id: "freight-labels",
  type: "symbol",
  source: STATIONS_SOURCE_ID,
  filter: ["all", ["==", ["get", "type"], "freight"], LABEL_MINZOOM_FILTER],
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
});

const railwayLineStyle = (): LayerProps => ({
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
});

const railwayBridgeStyle = (): LayerProps => ({
  id: "railway-lines-bridge",
  type: "line",
  source: "composite",
  "source-layer": "road",
  filter: ["all", ["==", ["get", "structure"], "bridge"], ["==", ["get", "class"], "major_rail"]],
  paint: {
    "line-color": "#4B61D1",
    "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 10, 1, 14, 2],
    "line-opacity": 0.6,
  },
});

const railwayTunnelStyle = (): LayerProps => ({
  id: "railway-lines-tunnel",
  type: "line",
  source: "composite",
  "source-layer": "road",
  filter: ["all", ["==", ["get", "structure"], "tunnel"], ["==", ["get", "class"], "major_rail"]],
  paint: {
    "line-color": "#4B61D1",
    "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 10, 1, 14, 2],
    "line-opacity": 0.4,
    "line-dasharray": [2, 2],
  },
});

export function StationMarkers() {
  const { current: map } = useMap();
  const { selectStation } = useSelectedStation();

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
      img.src = svgDataUri(svg);
    };

    loadIcon(RAIL_ICON_ID, RAIL_ICON_SVG);
    loadIcon(METRO_ICON_ID, METRO_ICON_SVG);
    loadIcon(LIGHT_ICON_ID, LIGHT_ICON_SVG);
    loadIcon(MARSHALLING_ICON_ID, FREIGHT_KIND_ICON_SVG.marshalling);
    loadIcon(INTERMODAL_ICON_ID, FREIGHT_KIND_ICON_SVG.intermodal);
    loadIcon(PORT_ICON_ID, FREIGHT_KIND_ICON_SVG.port);

    const handleClick = (e: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
      const station = e.features?.[0] && stationFromFeature(e.features[0]);
      if (station) selectStation(station);
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
    map.on("click", FREIGHT_LAYER_ID, handleClick);
    map.on("mouseenter", FREIGHT_LAYER_ID, handleMouseEnter);
    map.on("mouseleave", FREIGHT_LAYER_ID, handleMouseLeave);

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
      map.off("click", FREIGHT_LAYER_ID, handleClick);
      map.off("mouseenter", FREIGHT_LAYER_ID, handleMouseEnter);
      map.off("mouseleave", FREIGHT_LAYER_ID, handleMouseLeave);
    };
  }, [map, selectStation]);

  return (
    <>
      {/* Railway tracks */}
      <Layer {...railwayTunnelStyle()} />
      <Layer {...railwayLineStyle()} />
      <Layer {...railwayBridgeStyle()} />

      <Source id={STATIONS_SOURCE_ID} type="geojson" data={`${env.apiUrl}/stations.geojson`}>
        <Layer {...metroLayerStyle()} />
        <Layer {...metroLabelStyle()} />
        <Layer {...lightLayerStyle()} />
        <Layer {...lightLabelStyle()} />
        <Layer {...freightLayerStyle()} />
        <Layer {...freightLabelStyle()} />
        <Layer {...railLayerStyle()} />
        <Layer {...railLabelStyle()} />
      </Source>
    </>
  );
}
