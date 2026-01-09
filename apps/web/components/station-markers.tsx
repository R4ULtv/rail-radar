"use client";

import { useEffect, useMemo } from "react";
import { Layer, Source, useMap } from "react-map-gl/maplibre";
import type { LayerProps } from "react-map-gl/maplibre";
import { stationsCoords } from "@repo/data/stations";
import { useSelectedStation } from "@/hooks/use-selected-station";

const LAYER_ID = "stations";

const stationLayerStyle: LayerProps = {
  id: LAYER_ID,
  type: "circle",
  paint: {
    "circle-radius": 6,
    "circle-color": "#f97316",
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
    "circle-opacity": 0.9,
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
    </Source>
  );
}
