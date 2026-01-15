"use client";

import { useEffect, useMemo } from "react";
import { Layer, Source, useMap } from "react-map-gl/maplibre";
import type { LayerProps } from "react-map-gl/maplibre";
import { stationsCoords } from "@repo/data/stations";
import { useSelectedStation } from "@/hooks/use-selected-station";

const LAYER_ID = "stations";
const ICON_FULL = "station-icon-full";
const ICON_SIMPLE = "station-icon-simple";

const SVG_FULL_STRING = `
  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" style="fill-rule:evenodd;clip-rule:evenodd" viewBox="0 0 512 512"><path d="M488 152v208c0 70.645-57.355 128-128 128H152c-70.645 0-128-57.355-128-128V152C24 81.355 81.355 24 152 24h208c70.645 0 128 57.355 128 128Z" style="fill:#d14b4b;stroke:#fff;stroke-width:29px"/><path d="M8 3.1V7c0 2.194 1.806 4 4 4s4-1.806 4-4V3.1M9 15l-1-1M15 15l1-1" style="fill:none;fill-rule:nonzero;stroke:#fff;stroke-width:2px;stroke-linecap:round;stroke-linejoin:round" transform="matrix(14.66667 0 0 14.66667 80 80)"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4c0-4.389 3.611-8 8-8 4.389 0 8 3.611 8 8v4c0 2.8-2.2 5-5 5H9ZM8 19l-2 3M16 19l2 3" style="fill:none;fill-rule:nonzero;stroke:#fff;stroke-width:2px;stroke-linecap:round;stroke-linejoin:round" transform="matrix(14.66667 0 0 14.66667 80 80)"/></svg>`;

const SVG_SIMPLE_STRING = `
  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" style="fill-rule:evenodd;clip-rule:evenodd" viewBox="0 0 512 512"><path d="M488 152v208c0 70.645-57.355 128-128 128H152c-70.645 0-128-57.355-128-128V152C24 81.355 81.355 24 152 24h208c70.645 0 128 57.355 128 128Z" style="fill:#d14b4b;stroke:#fff;stroke-width:29px"/></svg>`;

const stationLayerStyle: LayerProps = {
  id: LAYER_ID,
  type: "symbol",
  layout: {
    "icon-image": ["step", ["zoom"], ICON_SIMPLE, 11, ICON_FULL],
    "icon-size": [
      "interpolate",
      ["linear"],
      ["zoom"],
      7,
      0.25, // At zoom 5 or lower, size is 0.3
      10,
      0.3, // At zoom 10, size is 0.5
      13,
      0.35, // At zoom 12 or higher, size is 0.75
    ],
    "icon-allow-overlap": false,
    "icon-anchor": "center",
  },
};

const stationLabelStyle: LayerProps = {
  id: "station-labels",
  type: "symbol",
  minzoom: 11,
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

function createStationsGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: stationsCoords
      .filter((station) => station.geo)
      .map((station) => ({
        type: "Feature" as const,
        id: station.id,
        properties: {
          id: station.id,
          name: station.name,
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

  useEffect(() => {
    if (!map) return;

    const loadIcon = (id: string, svgString: string) => {
      if (map.hasImage(id)) return;
      const img = new Image(64, 64);
      img.onload = () => {
        if (!map.hasImage(id)) {
          map.addImage(id, img);
        }
      };
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
    };

    loadIcon(ICON_FULL, SVG_FULL_STRING);
    loadIcon(ICON_SIMPLE, SVG_SIMPLE_STRING);

    const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;

      const id = feature.properties?.id;
      const name = feature.properties?.name;

      if (id === undefined || name === undefined) return;

      selectStation({ id, name });
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
  }, [map, selectStation]);

  return (
    <Source id="stations-source" type="geojson" data={geojsonData}>
      <Layer {...stationLayerStyle} />
      <Layer {...stationLabelStyle} />
    </Source>
  );
}
