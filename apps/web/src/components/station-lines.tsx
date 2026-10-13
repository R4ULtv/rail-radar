"use client";

import type { Line, LineRoute, Station } from "@repo/data";
import { getStationLines } from "@repo/data/lines";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import { cn } from "@repo/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { MapMouseEvent } from "mapbox-gl";
import { ArrowRightIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Layer, Source, useMap } from "react-map-gl/mapbox";
import type { LayerProps } from "react-map-gl/mapbox";

import { LineBadge } from "@/components/line-badge";
import { useLineData } from "@/hooks/use-line-data";
import { useSelectedStation } from "@/hooks/use-selected-station";
import type { LineData, LineStop } from "@/lib/api";
import { getLineBadgeCode, getLineColor } from "@/lib/line-colors";
import { OperatorTypeMarker } from "@/lib/operator-types";
import { prerenderedPageLinkProps } from "@/lib/station-prerender";
import { shortStationName } from "@/lib/station-name";

/** Room the open card (desktop) or the drawer's first snap point (mobile) takes over the map. */
const DESKTOP_PADDING = { top: 72, bottom: 48, left: 48, right: 432 };
const MOBILE_PADDING = { top: 80, bottom: 250, left: 32, right: 32 };

const STATION_LAYERS = ["metro-stations", "light-stations", "rail-stations"];
const STOPS_LAYER_ID = "station-lines-stops";

const NO_LINES: readonly Line[] = [];

/**
 * The lines serving a metro or light rail station, and which line and branch the
 * panel shows. The lines come from the bundled catalog, so the panel knows them at
 * once; only their track and stop names are fetched, once per line. The choice
 * survives stepping along the line to another of its stops.
 */
export function useStationLineView(station: Station | null) {
  const stationId = station && station.type !== "rail" ? station.id : null;
  const lines = stationId ? getStationLines(stationId) : NO_LINES;
  const ids = useMemo(() => lines.map((line) => line.id), [lines]);
  const query = useLineData(ids);
  const queryClient = useQueryClient();
  const { selectStation } = useSelectedStation();
  const [preferred, setPreferred] = useState<{ lineId: string | null; route: number | null }>({
    lineId: null,
    route: null,
  });

  const loaded = useMemo(
    () =>
      new Map(query.data.flatMap((data): [string, LineData][] => (data ? [[data.id, data]] : []))),
    [query.data],
  );
  const stops = useMemo(() => {
    const merged: Record<string, LineStop> = {};
    for (const data of loaded.values()) Object.assign(merged, data.stops);
    return merged;
  }, [loaded]);

  const index = Math.max(
    ids.findIndex((id) => id === preferred.lineId),
    0,
  );
  const line = lines[index] ?? null;
  const routes = line
    ? line.routes.flatMap((route, i) =>
        stationId && route.stations.includes(stationId) ? [i] : [],
      )
    : [];
  const route =
    line?.id === preferred.lineId && preferred.route !== null && routes.includes(preferred.route)
      ? preferred.route
      : (routes[0] ?? 0);

  const selectStop = (id: string) => {
    const stop = stops[id];
    if (!stop) return;
    if (line) setPreferred({ lineId: line.id, route });
    selectStation({
      id,
      name: stop.name,
      type: stop.type,
      importance: stop.importance,
      geo: stop.geo,
    });
  };

  return {
    stationId,
    lines,
    line,
    routes,
    route,
    /** Track and stops of the lines loaded so far. */
    loaded,
    /** Every loaded stop, by station ID. */
    stops,
    isLoading: line !== null && (query.isPending[index] ?? false),
    isError: line !== null && (query.isError[index] ?? false),
    retry: () =>
      void queryClient.refetchQueries({
        queryKey: ["line"],
        predicate: (cached) => cached.state.status === "error",
      }),
    selectLine: (lineId: string) => setPreferred({ lineId, route: null }),
    selectRoute: (i: number) => setPreferred({ lineId: line?.id ?? null, route: i }),
    selectStop,
  };
}

export type StationLineView = ReturnType<typeof useStationLineView>;

function stopName(view: StationLineView, id: string | undefined): string {
  const name = id ? view.stops[id]?.name : undefined;
  return name ? shortStationName(name) : "";
}

/* ------------------------------------------------------------------ map */

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

/* ---------------------------------------------------------------- panel */

/** "Metro · 2 lines", or what the panel is waiting for. */
export function StationLinesSummary({
  station,
  view,
}: {
  station: Station | null;
  view: StationLineView;
}) {
  if (!station) return null;
  const metro = station.type === "metro";
  const count = view.lines.length;
  return (
    <span className="flex items-center gap-1.5">
      <OperatorTypeMarker type={metro ? "metro" : "light-rail"} className="size-4" />
      {metro ? "Metro" : "Light rail"}
      {count > 0 && (
        <>
          <span aria-hidden>·</span>
          {count === 1 ? "1 line" : `${count} lines`}
        </>
      )}
    </span>
  );
}

function badgeLine(line: Line) {
  return { code: line.code, name: line.name, type: line.type, color: getLineColor(line) };
}

/**
 * Chip labels without the words every line shares, so "Circumvesuviana Napoli–Sarno"
 * and "Circumvesuviana Napoli–Sorrento" read "Sarno" and "Sorrento", and "Metropolitana
 * M1" reads "M1". A label that only repeats the badge's code is dropped.
 */
function chipLabels(lines: readonly Line[]): Map<string, string | null> {
  const names = lines.map((line) => line.name);
  let prefix = names.length > 1 ? names[0]! : "";
  for (const name of names) {
    while (!name.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  // Cut back to a word boundary so a shared first letter doesn't get stripped.
  const cut = Math.max(...[" ", "–", "-", "/"].map((separator) => prefix.lastIndexOf(separator)));
  const strip = cut + 1;
  return new Map(
    lines.map((line) => {
      const label = line.name.slice(strip).trim() || line.name;
      return [line.id, label === getLineBadgeCode(line) ? null : label];
    }),
  );
}

/**
 * One chip per line serving the station, when there is more than one. Chips wrap on
 * desktop; in the drawer they scroll sideways to keep its header short.
 */
export function LinePicker({
  view,
  scroll = false,
  className,
}: {
  view: StationLineView;
  scroll?: boolean;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeId = view.line?.id;
  const labels = useMemo(() => chipLabels(view.lines), [view.lines]);

  useEffect(() => {
    const list = listRef.current;
    const chip = list?.querySelector<HTMLElement>("[aria-selected=true]");
    if (!scroll || !list || !chip) return;
    list.scrollLeft = chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2;
  }, [activeId, scroll]);

  if (view.lines.length < 2) return null;

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Lines"
      className={cn(
        "flex gap-1.5",
        scroll
          ? "-ml-4 overflow-x-auto pl-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex-wrap",
        className,
      )}
    >
      {view.lines.map((line) => {
        const selected = line.id === activeId;
        const color = getLineColor(line);
        const label = labels.get(line.id);
        return (
          <button
            key={line.id}
            type="button"
            role="tab"
            aria-selected={selected}
            title={line.name}
            onClick={() => view.selectLine(line.id)}
            className={cn(
              "flex h-8 min-w-0 shrink-0 items-center gap-1.5 rounded-xl px-1.5 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              label && "pr-2.5",
              selected
                ? "text-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            style={
              selected
                ? {
                    backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`,
                    boxShadow: `inset 0 0 0 1.5px ${color}`,
                  }
                : undefined
            }
          >
            <LineBadge line={badgeLine(line)} />
            {label && <span className="max-w-32 truncate">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The shown branch at a glance, "Rho Fiera – Sesto 1° Maggio FS · 38 stops", with a
 * link to the line's page. A station with one line also gets its badge here.
 */
export function LineInfo({ view, className }: { view: StationLineView; className?: string }) {
  const { line, route } = view;
  if (!line) return null;
  const stations = line.routes[route]?.stations ?? [];
  const first = stations[0];
  const last = stations.at(-1);
  // The API can lack a stop of the bundled catalog (each deploys on its own), so the
  // termini can stay unnamed after the line loads.
  const named = !!first && !!last && !!view.stops[first] && !!view.stops[last];

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      {view.lines.length === 1 && <LineBadge line={badgeLine(line)} />}
      <div className="flex min-w-0 flex-1 text-xs text-muted-foreground">
        {named ? (
          <>
            <span className="truncate">
              {stopName(view, first)} – {stopName(view, last)}
            </span>
            <span className="shrink-0 whitespace-pre"> · {stations.length} stops</span>
          </>
        ) : view.isLoading ? (
          <Skeleton className="h-3 w-44" />
        ) : (
          line.name
        )}
      </div>
      <LinePageLink view={view} />
    </div>
  );
}

/** Link to the shown line's page. */
export function LinePageLink({ view, className }: { view: StationLineView; className?: string }) {
  if (!view.line) return null;
  return (
    <Button
      variant="ghost"
      size="xs"
      nativeButton={false}
      className={cn("-mr-2 shrink-0 text-muted-foreground", className)}
      render={
        <Link to="/lines/$id" params={{ id: view.line.id }} {...prerenderedPageLinkProps}>
          Line page
          <ArrowRightIcon />
        </Link>
      }
      aria-label={`Open the ${view.line.name} page`}
    />
  );
}

/**
 * Branch labels that say where each one goes: when every branch starts (or ends) at
 * the same stop, only the other end tells them apart, and branches that each end
 * somewhere else read as their destination.
 */
function branchLabel(view: StationLineView, routes: LineRoute[], route: LineRoute): string {
  const firsts = new Set(routes.map((other) => other.stations[0]));
  const lasts = new Set(routes.map((other) => other.stations.at(-1)));
  const first = stopName(view, route.stations[0]);
  const last = stopName(view, route.stations.at(-1));
  if (firsts.size === 1 && lasts.size === routes.length) return last;
  if (lasts.size === 1 && firsts.size === routes.length) return first;
  if (lasts.size === routes.length) return `To ${last}`;
  return `${first} – ${last}`;
}

/** The shown line's branches through the station, when there is more than one. */
export function BranchPicker({ view, className }: { view: StationLineView; className?: string }) {
  if (!view.line || view.routes.length < 2) return null;
  const all = view.line.routes;
  const routes = view.routes.map((index) => all[index]!);
  const named = routes.every((route) =>
    [route.stations[0], route.stations.at(-1)].every((id) => !!id && !!view.stops[id]),
  );

  return (
    <div
      role="tablist"
      aria-label="Branches"
      className={cn("flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1", className)}
    >
      {view.routes.map((index, position) => {
        const route = all[index]!;
        const selected = index === view.route;
        return (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => view.selectRoute(index)}
            className={cn(
              "flex h-7 min-w-0 flex-1 basis-24 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              selected
                ? "bg-card text-foreground shadow-sm ring-1 ring-foreground/5 dark:bg-input/60"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {route.code && <span className="shrink-0 font-semibold">{route.code}</span>}
            {named ? (
              <span className="truncate">{branchLabel(view, routes, route)}</span>
            ) : view.isLoading ? (
              <Skeleton className="h-3 w-16" />
            ) : (
              !route.code && `Branch ${position + 1}`
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The shown branch as a vertical strip map in the line's color, scrolled to the
 * station. `align="start"` puts it near the top for the drawer's short snap points,
 * where `padEnd` leaves room to do that for stops near the end of the branch and
 * `peek` is how much of the drawer the snap point shows.
 */
export function StopStrip({
  view,
  align = "center",
  padEnd = false,
  peek,
  className,
}: {
  view: StationLineView;
  align?: "center" | "start";
  padEnd?: boolean;
  peek?: number;
  className?: string;
}) {
  const currentRef = useRef<HTMLLIElement>(null);
  const { stops, lines, line, route, stationId, isLoading, isError } = view;
  // Stops the API doesn't know (it deploys apart from the bundled catalog) are left out
  // rather than waited for.
  const stations = (line?.routes[route]?.stations ?? []).filter((id) => stops[id] !== undefined);
  const ready = line !== null && !isLoading;
  const shownRef = useRef<string | null>(null);

  useEffect(() => {
    const row = currentRef.current;
    const scroller = row?.closest<HTMLElement>("[data-slot=scroll-area-viewport], [data-scroll]");
    if (!row || !scroller) return;
    const box = scroller.getBoundingClientRect();
    const offset = row.getBoundingClientRect().top - box.top + scroller.scrollTop;
    // The drawer's lower snap points leave part of the strip below the screen. Measured
    // against the drawer rather than the screen, since it may still be sliding into place.
    const drawer = scroller.closest("[data-slot=drawer-popup]")?.getBoundingClientRect();
    const below = peek !== undefined && drawer ? peek - (box.top - drawer.top) : Infinity;
    const visible = Math.max(Math.min(scroller.clientHeight, below), 0);
    const room = Math.max(visible - row.offsetHeight, 0);
    // A third of the way down in the drawer, so the stop clears the top fade and the
    // ones before it still show.
    const top = offset - room * (align === "center" ? 0.5 : 0.3);
    // Glide when stepping along the branch already shown; jump to a new line or branch.
    const shown = `${line?.id}/${route}`;
    const step = shownRef.current === shown;
    shownRef.current = shown;
    scroller.scrollTo({ top, behavior: step ? "smooth" : "instant" });
  }, [stationId, line?.id, route, align, padEnd, peek, ready]);

  if (!stationId) return null;

  if (lines.length === 0) {
    return (
      <p className={cn("px-4 py-8 text-center text-sm text-muted-foreground", className)}>
        The lines of this station aren't mapped yet.
      </p>
    );
  }

  if (isError) {
    return (
      <div className={cn("flex flex-col items-center gap-3 px-4 py-8 text-center", className)}>
        <p className="text-sm text-muted-foreground">Couldn't load this line.</p>
        <Button variant="outline" size="sm" onClick={view.retry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!line || !ready) return <StopStripSkeleton className={className} />;

  if (stations.length === 0) {
    return (
      <p className={cn("px-4 py-8 text-center text-sm text-muted-foreground", className)}>
        The stops of this line aren't available right now.
      </p>
    );
  }

  const color = getLineColor(line);
  const served = new Set(lines.map((other) => other.id));

  return (
    <ol className={cn("px-3 pb-3", padEnd && "pb-[60vh]", className)}>
      {stations.map((id, index) => {
        const stop = stops[id]!;
        const first = index === 0;
        const last = index === stations.length - 1;
        const current = id === stationId;
        const others = getStationLines(id).filter((other) => other.id !== line.id);
        return (
          <li
            key={`${id}-${index}`}
            ref={current ? currentRef : undefined}
            aria-current={current ? "location" : undefined}
            className="relative flex"
          >
            <div className="relative flex w-5 shrink-0 justify-center" aria-hidden>
              <span
                className={cn(
                  "absolute w-1",
                  first ? "top-1/2" : "top-0",
                  last ? "bottom-1/2" : "bottom-0",
                )}
                style={{ backgroundColor: color }}
              />
              <span
                className={cn(
                  "relative self-center rounded-full",
                  current
                    ? "size-4"
                    : first || last
                      ? "size-3.5 border-[3px] bg-card"
                      : "size-2.5 border-2 bg-card",
                )}
                style={
                  current
                    ? {
                        backgroundColor: color,
                        boxShadow: `0 0 0 3px var(--color-card), 0 0 0 5px color-mix(in oklab, ${color} 45%, transparent)`,
                      }
                    : { borderColor: color }
                }
              />
            </div>
            <div
              className={cn(
                "relative ml-1 flex min-h-9 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2.5 py-1 transition-colors duration-150",
                !current && "lg:has-[>[data-stop]:hover]:bg-muted/60",
              )}
              style={
                current
                  ? { backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)` }
                  : undefined
              }
            >
              {current ? (
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {shortStationName(stop.name)}
                </span>
              ) : (
                <button
                  type="button"
                  data-stop
                  onClick={() => view.selectStop(id)}
                  className={cn(
                    "min-w-0 flex-1 truncate text-left text-sm after:absolute after:inset-0 after:rounded-lg",
                    first || last ? "font-medium" : "text-foreground/85",
                  )}
                >
                  {shortStationName(stop.name)}
                </button>
              )}
              {others.map((other) =>
                served.has(other.id) ? (
                  <button
                    key={other.id}
                    type="button"
                    onClick={() => view.selectLine(other.id)}
                    title={`Show ${other.name}`}
                    className="relative z-10 flex shrink-0 rounded-[5px] transition-opacity hover:opacity-80"
                  >
                    <LineBadge line={badgeLine(other)} size="xs" />
                  </button>
                ) : (
                  <LineBadge key={other.id} line={badgeLine(other)} size="xs" />
                ),
              )}
              {stop.type === "rail" && (
                <span title="Train station" className="flex shrink-0">
                  <OperatorTypeMarker type="passenger" className="size-4" />
                  <span className="sr-only">Train station</span>
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StopStripSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("px-3 pb-3", className)} aria-hidden>
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex">
          <div className="flex w-5 shrink-0 justify-center">
            <div className="w-1 bg-muted" />
          </div>
          <div className="ml-1 flex min-h-9 flex-1 items-center px-2.5">
            <Skeleton className="h-3.5" style={{ width: `${45 + ((index * 37) % 40)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
