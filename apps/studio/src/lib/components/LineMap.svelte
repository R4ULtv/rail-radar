<script lang="ts">
  import type { Line, LineGeometry, Station } from "@repo/data";
  import { getLineStationIds } from "@repo/data/lines";
  import * as maplibregl from "$lib/maplibre";
  import type {
    DataDrivenPropertyValueSpecification,
    GeoJSONSource,
    Map as LibreMap,
  } from "maplibre-gl";
  import { onMount, untrack } from "svelte";
  import { DEFAULT_LINE_COLOR } from "$lib/line-colors";
  import { STATION_TYPE_COLOR } from "$lib/station-colors";

  let {
    lines,
    geometries,
    stations,
    selectedLineId,
    selectionKey,
    selectedRouteIndex,
    focusedStationId,
    onSelectLine,
    onFocusStation,
  }: {
    lines: Line[];
    geometries: Map<string, LineGeometry>;
    stations: Station[];
    selectedLineId: string | null;
    /** Changes when a different line is opened, so editing the draft's ID doesn't refit the map. */
    selectionKey: number;
    /** Highlights this branch's stops; the track is shared by the whole line. */
    selectedRouteIndex: number | null;
    focusedStationId: string | null;
    onSelectLine: (id: string) => void;
    onFocusStation: (id: string) => void;
  } = $props();
  let container: HTMLDivElement;
  let map: LibreMap | null = null;
  let loaded = $state(false);
  let error = $state<string | null>(null);
  const stationById = $derived(new Map(stations.map((station) => [station.id, station])));
  const hasSelection = $derived(selectedLineId !== null);

  function lineFeatures() {
    return {
      type: "FeatureCollection" as const,
      features: lines.flatMap((line) => {
        const geometry = geometries.get(line.id);
        if (!geometry) return [];
        return [
          {
            type: "Feature" as const,
            properties: {
              lineId: line.id,
              color: line.color ?? DEFAULT_LINE_COLOR,
              active: line.id === selectedLineId,
            },
            // MapLibre sends geometry to a worker, which needs ordinary objects, not state proxies.
            geometry: $state.snapshot(geometry),
          },
        ];
      }),
    };
  }

  function stationFeatures() {
    const activeLine = lines.find((line) => line.id === selectedLineId);
    const activeRoutes =
      activeLine?.routes.filter(
        (_, index) => selectedRouteIndex === null || index === selectedRouteIndex,
      ) ?? [];
    const activeIds = new Set(activeRoutes.flatMap((route) => route.stations));
    const endpoints = new Set(
      activeRoutes.flatMap((route) => [route.stations[0], route.stations.at(-1)]),
    );
    const ids = new Set(lines.flatMap(getLineStationIds));
    if (focusedStationId) ids.add(focusedStationId);
    return {
      type: "FeatureCollection" as const,
      features: [...ids].flatMap((id) => {
        const station = stationById.get(id);
        if (!station?.geo) return [];
        return [
          {
            type: "Feature" as const,
            properties: {
              id,
              name: station.name,
              type: station.type,
              active: activeIds.has(id),
              endpoint: endpoints.has(id),
              focused: id === focusedStationId,
            },
            geometry: { type: "Point" as const, coordinates: [station.geo.lng, station.geo.lat] },
          },
        ];
      }),
    };
  }

  function fitSelection() {
    if (!loaded || !map) return;
    // Opening the inspector changes the container before MapLibre's resize observer runs.
    map.resize();
    const selection = selectedLineId ? lines.filter((line) => line.id === selectedLineId) : lines;
    const bounds = new maplibregl.LngLatBounds();
    for (const line of selection) {
      if (!selectedLineId) {
        for (const segment of geometries.get(line.id)?.coordinates ?? []) {
          for (const position of segment) bounds.extend([position[0]!, position[1]!]);
        }
      }
      for (const [index, route] of line.routes.entries()) {
        if (selectedLineId && selectedRouteIndex !== null && index !== selectedRouteIndex) continue;
        for (const id of route.stations) {
          const station = stationById.get(id);
          if (station?.geo) bounds.extend([station.geo.lng, station.geo.lat]);
        }
      }
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 55, maxZoom: 14, duration: 350 });
  }

  $effect(() => {
    if (!loaded || !map) return;
    (map.getSource("line-routes") as GeoJSONSource).setData(lineFeatures());
    (map.getSource("line-stations") as GeoJSONSource).setData(stationFeatures());
    map.setPaintProperty(
      "routes",
      "line-opacity",
      selectedLineId ? ["case", ["get", "active"], 1, 0.16] : 0.85,
    );
    const stopOpacity: DataDrivenPropertyValueSpecification<number> = selectedLineId
      ? ["case", ["get", "active"], 1, 0.2]
      : 1;
    map.setPaintProperty("stops", "circle-opacity", stopOpacity);
    map.setPaintProperty("stops", "circle-stroke-opacity", stopOpacity);
    map.setPaintProperty(
      "stop-labels",
      "text-opacity",
      selectedLineId ? ["case", ["get", "active"], 1, 0.35] : 1,
    );
  });
  $effect(() => {
    // Fit when the selection changes, without interrupting map movement on every draft edit.
    void selectionKey;
    void hasSelection;
    void selectedRouteIndex;
    if (loaded) untrack(fitSelection);
  });
  $effect(() => {
    const station = focusedStationId ? stationById.get(focusedStationId) : null;
    if (map && loaded && station?.geo) {
      map.flyTo({
        center: [station.geo.lng, station.geo.lat],
        zoom: Math.max(map.getZoom(), 13),
        duration: 350,
      });
    }
  });

  onMount(() => {
    map = new maplibregl.Map({
      container,
      style: "https://tiles.openfreemap.org/styles/dark",
      center: [12.5, 42.5],
      zoom: 5,
      maxPitch: 0,
      attributionControl: false,
    });
    map.setMissingStyleImageResolver((id) => {
      if (map && !map.hasImage(id))
        map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
    });
    map.on("error", (event) => {
      if (!loaded) error = event.error.message;
    });
    map.on("load", () => {
      if (!map) return;
      error = null;
      map.addSource("line-routes", { type: "geojson", data: lineFeatures() });
      map.addLayer({
        id: "routes",
        type: "line",
        source: "line-routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            ["case", ["get", "active"], 3, 2],
            10,
            ["case", ["get", "active"], 4.5, 3],
            15,
            ["case", ["get", "active"], 7, 5],
          ],
        },
      });
      map.addSource("line-stations", { type: "geojson", data: stationFeatures() });
      map.addLayer({
        id: "stops",
        type: "circle",
        source: "line-stations",
        paint: {
          // Matches the stations map: type color with a white ring.
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            ["case", ["get", "focused"], 6, ["get", "endpoint"], 3.5, 2.5],
            10,
            ["case", ["get", "focused"], 9, ["get", "endpoint"], 6, 4.5],
            15,
            ["case", ["get", "focused"], 11, ["get", "endpoint"], 8, 7],
          ],
          "circle-color": [
            "match",
            ["get", "type"],
            "metro",
            STATION_TYPE_COLOR.metro,
            "light",
            STATION_TYPE_COLOR.light,
            STATION_TYPE_COLOR.rail,
          ],
          "circle-stroke-color": "#ffffff",
          // Thin rings at country zoom keep clustered stops from merging into white blobs.
          "circle-stroke-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            6,
            ["case", ["get", "focused"], 2, 0.5],
            11,
            ["case", ["get", "focused"], 3, 1],
          ],
        },
      });
      map.addLayer({
        id: "stop-labels",
        type: "symbol",
        source: "line-stations",
        minzoom: 11,
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-font": ["Noto Sans Regular"],
          "text-offset": [0, 1.4],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#f4f4f5",
          "text-halo-color": "#09090b",
          "text-halo-width": 1.5,
        },
      });
      map.on("click", "routes", (event) => {
        // A stop drawn over another line's track should focus the stop, not switch lines.
        if (map?.queryRenderedFeatures(event.point, { layers: ["stops"] }).length) return;
        const id = event.features?.[0]?.properties?.lineId;
        if (typeof id === "string") onSelectLine(id);
      });
      map.on("click", "stops", (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") onFocusStation(id);
      });
      for (const layer of ["routes", "stops"]) {
        map.on("mouseenter", layer, () => {
          if (map) map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          if (map) map.getCanvas().style.cursor = "";
        });
      }
      loaded = true;
      fitSelection();
    });
    const observer = new ResizeObserver(() => map?.resize());
    observer.observe(container);
    return () => {
      observer.disconnect();
      map?.remove();
      map = null;
    };
  });
</script>

<div class="relative h-full w-full">
  <div
    bind:this={container}
    class="h-full w-full"
    aria-label="Transit lines and stations map"
  ></div>
  <div
    class="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-md border border-border bg-card/90 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground shadow-sm backdrop-blur"
    aria-label="Map legend"
  >
    <div class="text-[10px] uppercase tracking-wider text-muted-foreground/70">Legend</div>
    <div class="flex items-center gap-2">
      <span class="size-2 rounded-full" style:background-color={STATION_TYPE_COLOR.rail}></span>
      <span>Rail stop</span>
    </div>
    <div class="flex items-center gap-2">
      <span class="size-2 rounded-full" style:background-color={STATION_TYPE_COLOR.metro}></span>
      <span>Metro stop</span>
    </div>
    <div class="flex items-center gap-2">
      <span class="size-2 rounded-full" style:background-color={STATION_TYPE_COLOR.light}></span>
      <span>Light rail stop</span>
    </div>
  </div>

  {#if error}
    <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div role="alert" class="max-w-sm rounded-md bg-black/75 px-4 py-2 text-sm text-white">
        Map unavailable: {error}
      </div>
    </div>
  {/if}
</div>
