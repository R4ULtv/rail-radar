"use client";

import type { Station } from "@repo/data";
import { getStationLines } from "@repo/data/lines";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import type { MapMouseEvent } from "mapbox-gl";
import { useEffect, useMemo, useRef } from "react";
import { Layer, Source, useMap } from "react-map-gl/mapbox";
import type { LayerProps } from "react-map-gl/mapbox";

import { getLineColor } from "@/lib/line-colors";
import { shortStationName } from "@/lib/station-name";
import type { StationLineView } from "./use-station-line-view";

/** Room the open card (desktop) or the drawer's first snap point (mobile) takes over the map. */
const DESKTOP_PADDING = { top: 72, bottom: 48, left: 48, right: 432 };
const MOBILE_PADDING = { top: 80, bottom: 250, left: 32, right: 32 };

const STATION_LAYERS = ["metro-stations", "light-stations", "rail-stations", "freight-stations"];
const STOPS_LAYER_ID = "station-lines-stops";

const lineCasingStyle: LayerProps = {
  id: "station-lines-casing",
  type: "line",
  layout: {
    "line-join": "round",
    "line-cap": "round",
    "line-sort-key": ["case", ["get", "active"], 1, 0],
  },
  paint: {
    "line-color": "#000000",
    "line-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      10,
      ["case", ["get", "active"], 5, 2.5],
      14,
      ["case", ["get", "active"], 9, 4.5],
      17,
      ["case", ["get", "active"], 12, 6],
    ],
    "line-opacity": ["case", ["get", "active"], 0.5, 0.15],
  },
};

const lineStyle: LayerProps = {
  id: "station-lines-line",
  type: "line",
  layout: {
    "line-join": "round",
    "line-cap": "round",
    "line-sort-key": ["case", ["get", "active"], 1, 0],
  },
  paint: {
    "line-color": ["get", "color"],
    "line-width": [
      "interpolate",
      ["linear"],
      ["zoom"],
      10,
      ["case", ["get", "active"], 3, 1.5],
      14,
      ["case", ["get", "active"], 6, 3],
      17,
      ["case", ["get", "active"], 9, 4],
    ],
    "line-opacity": ["case", ["get", "active"], 1, 0.35],
  },
};

const stopsStyle: LayerProps = {
  id: STOPS_LAYER_ID,
  type: "circle",
  layout: { "circle-sort-key": ["get", "rank"] },
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 14, 5, 17, 7],
    "circle-color": "#ffffff",
    "circle-stroke-color": ["get", "color"],
    "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 14, 2.5],
    "circle-opacity": ["get", "opacity"],
    "circle-stroke-opacity": ["get", "opacity"],
  },
};

const currentHaloStyle: LayerProps = {
  id: "station-lines-current-halo",
  type: "circle",
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 10, 15, 16],
    "circle-color": ["get", "color"],
    "circle-opacity": 0.25,
  },
};

const currentStyle: LayerProps = {
  id: "station-lines-current",
  type: "circle",
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 15, 8],
    "circle-color": ["get", "color"],
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 3,
  },
};

const labelsStyle: LayerProps = {
  id: "station-lines-labels",
  type: "symbol",
  layout: {
    "text-field": ["get", "name"],
    "text-size": ["case", ["get", "current"], 13, 12],
    "text-offset": [0, 1.1],
    "text-anchor": "top",
    "symbol-sort-key": ["case", ["get", "current"], 0, 1],
  },
  paint: {
    "text-color": "#ffffff",
    "text-halo-color": "rgba(0,0,0,0.6)",
    "text-halo-width": 1.5,
    "text-halo-blur": 1,
  },
};

function point<P>(geo: { lat: number; lng: number }, properties: P) {
  return {
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [geo.lng, geo.lat] },
    properties,
  };
}

/** The station's lines drawn under the station markers, the shown line bold, the rest faint. */
export function StationLinesMap({
  station,
  view,
}: {
  station: Station | null;
  view: StationLineView;
}) {
  const { current: map } = useMap();
  const isMobile = useIsMobile();
  const { loaded, stops: allStops, lines, line, route, stationId } = view;
  const geo = stationId ? station?.geo : undefined;

  const collections = useMemo(() => {
    // Wait for the shown line: its stops frame the map and label the termini.
    if (!line || !loaded.has(line.id) || !stationId || !geo) return null;
    const shown = new Set(lines.map((other) => other.id));
    const onLine = new Set(line.routes.flatMap((r) => r.stations));
    const routeStops = line.routes[route]?.stations ?? [];
    const onRoute = new Set(routeStops);
    const colors = new Map(lines.map((other) => [other.id, getLineColor(other)]));
    const lineColor = colors.get(line.id)!;

    const stops = Object.entries(allStops).flatMap(([id, stop]) => {
      const serving = getStationLines(id).filter((other) => shown.has(other.id));
      if (id === stationId || !stop.geo || serving.length === 0) return [];
      const rank = onRoute.has(id) ? 2 : onLine.has(id) ? 1 : 0;
      return [
        point(stop.geo, {
          id,
          rank,
          opacity: [0.35, 0.45, 1][rank],
          color: rank > 0 ? lineColor : colors.get(serving[0]!.id)!,
        }),
      ];
    });

    const termini = [routeStops[0], routeStops.at(-1)].filter(
      (id): id is string => id !== undefined && id !== stationId,
    );
    const labels = [
      point(geo, { name: shortStationName(allStops[stationId]?.name ?? ""), current: true }),
      ...termini.flatMap((id) => {
        const stop = allStops[id];
        return stop?.geo
          ? [point(stop.geo, { name: shortStationName(stop.name), current: false })]
          : [];
      }),
    ];

    return {
      lines: {
        type: "FeatureCollection" as const,
        features: lines.flatMap((other) => {
          const geometry = loaded.get(other.id)?.geometry;
          return geometry
            ? [
                {
                  type: "Feature" as const,
                  geometry,
                  properties: { color: colors.get(other.id)!, active: other.id === line.id },
                },
              ]
            : [];
        }),
      },
      stops: { type: "FeatureCollection" as const, features: stops },
      current: {
        type: "FeatureCollection" as const,
        features: [point(geo, { color: lineColor })],
      },
      labels: { type: "FeatureCollection" as const, features: labels },
      bounds: routeStops.reduce(
        (acc, id) => {
          const stop = allStops[id]?.geo;
          if (!stop) return acc;
          return [
            Math.min(acc[0], stop.lng),
            Math.min(acc[1], stop.lat),
            Math.max(acc[2], stop.lng),
            Math.max(acc[3], stop.lat),
          ] as [number, number, number, number];
        },
        [geo.lng, geo.lat, geo.lng, geo.lat] as [number, number, number, number],
      ),
    };
  }, [loaded, allStops, lines, line, route, stationId, geo]);

  // Show the whole branch when the line or branch changes; follow the station along it otherwise.
  // The line is known before its stops load, so only fit once they're here to bound it.
  const fitKey = line && collections ? `${line.id}/${route}` : null;
  const failed = stationId !== null && (view.isError || lines.length === 0);
  const boundsRef = useRef(collections?.bounds);
  boundsRef.current = collections?.bounds;
  const lastFit = useRef<{ key: string; stationId: string } | null>(null);
  useEffect(() => {
    if (!map || !stationId || !geo) {
      lastFit.current = null;
      return;
    }
    const padding = isMobile ? MOBILE_PADDING : DESKTOP_PADDING;
    const center: [number, number] = [geo.lng, geo.lat];
    if (failed) {
      map.flyTo({ center, zoom: 15, padding });
      lastFit.current = null;
      return;
    }
    const bounds = boundsRef.current;
    if (!fitKey || !bounds) return;
    if (lastFit.current?.key !== fitKey) {
      map.fitBounds(bounds, { padding, maxZoom: 15, duration: 1200 });
    } else if (lastFit.current.stationId !== stationId) {
      map.easeTo({ center, padding });
    }
    lastFit.current = { key: fitKey, stationId };
  }, [map, stationId, geo, fitKey, failed, isMobile]);

  const selectStopRef = useRef(view.selectStop);
  selectStopRef.current = view.selectStop;
  useEffect(() => {
    if (!map) return;
    const handleClick = (e: MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (!id) return;
      // A visible station marker on top handles the click itself.
      const layers = STATION_LAYERS.filter((layer) => map.getLayer(layer));
      if (map.queryRenderedFeatures(e.point, { layers }).length > 0) return;
      selectStopRef.current(id);
    };
    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };
    map.on("click", STOPS_LAYER_ID, handleClick);
    map.on("mouseenter", STOPS_LAYER_ID, handleMouseEnter);
    map.on("mouseleave", STOPS_LAYER_ID, handleMouseLeave);
    return () => {
      map.off("click", STOPS_LAYER_ID, handleClick);
      map.off("mouseenter", STOPS_LAYER_ID, handleMouseEnter);
      map.off("mouseleave", STOPS_LAYER_ID, handleMouseLeave);
    };
  }, [map]);

  if (!collections) return null;

  return (
    <>
      <Source id="station-lines-source" type="geojson" data={collections.lines}>
        <Layer {...lineCasingStyle} beforeId="metro-stations" />
        <Layer {...lineStyle} beforeId="metro-stations" />
      </Source>
      <Source id="station-lines-stops-source" type="geojson" data={collections.stops}>
        <Layer {...stopsStyle} beforeId="metro-stations" />
      </Source>
      <Source id="station-lines-current-source" type="geojson" data={collections.current}>
        <Layer {...currentHaloStyle} />
        <Layer {...currentStyle} />
      </Source>
      <Source id="station-lines-labels-source" type="geojson" data={collections.labels}>
        <Layer {...labelsStyle} />
      </Source>
    </>
  );
}
