"use client";

import type { MapMouseEvent } from "mapbox-gl";
import { useEffect, useMemo } from "react";
import { Layer, Source, useMap } from "react-map-gl/mapbox";
import type { LayerProps } from "react-map-gl/mapbox";
import { stationsCoords } from "@repo/data/stations";
import { useSelectedStation } from "@/hooks/use-selected-station";

const LAYER_ID = "stations";
const ICON_ID = "station-icon";

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 512 512" fill="none">
  <rect id="a" width="464" height="464" x="24" y="24" fill="#4B61D1" stroke="#FFF" stroke-opacity="100%" stroke-width="48" paint-order="stroke" rx="112"/>
  <svg xmlns="http://www.w3.org/2000/svg" width="352" height="352" x="80" y="80" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" alignment-baseline="middle" viewBox="0 0 24 24"><path d="M8 3.1V7a4 4 0 0 0 8 0V3.1M9 15l-1-1M15 15l1-1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5ZM8 19l-2 3M16 19l2 3"/>
  </svg></svg>`;

const stationLayerStyle: LayerProps = {
  id: LAYER_ID,
  type: "symbol",
  minzoom: 7,
  layout: {
    "icon-image": ICON_ID,
    "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.3, 13, 0.35],
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

    const loadIcon = () => {
      if (map.hasImage(ICON_ID)) return;
      const img = new Image(64, 64);
      img.onload = () => {
        if (!map.hasImage(ICON_ID)) {
          map.addImage(ICON_ID, img);
        }
      };
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ICON_SVG)}`;
    };

    loadIcon();

    const handleClick = (
      e: MapMouseEvent & { features?: GeoJSON.Feature[] },
    ) => {
      const feature = e.features?.[0];
      if (!feature?.properties) return;

      const id = feature.properties.id as number | undefined;
      const name = feature.properties.name as string | undefined;

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
