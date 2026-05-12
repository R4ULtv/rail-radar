<script lang="ts">
  import type { Station } from "@repo/data";
  import maplibregl, { type GeoJSONSource, type Map, type Marker } from "maplibre-gl";
  import { onDestroy, onMount } from "svelte";
  import { STATION_TYPE_COLOR } from "$lib/station-colors";

  const SOURCE_ID = "stations-source";
  const LAYER_ID = "stations-layer";
  const SELECTED_STATION_ZOOM = 10;

  let {
    stations,
    selectedStationId,
    isAddingStation,
    onSelectStation,
    onMarkerDragEnd,
    onMapClick,
    onSetStationLocation,
  }: {
    stations: Station[];
    selectedStationId: string | null;
    isAddingStation: boolean;
    onSelectStation: (id: string) => void;
    onMarkerDragEnd: (id: string, lat: number, lng: number) => void;
    onMapClick: (lat: number, lng: number) => void;
    onSetStationLocation: (lat: number, lng: number) => void;
  } = $props();

  let container: HTMLDivElement | null = null;
  let map: Map | null = null;
  let marker: Marker | null = null;
  let loaded = $state(false);

  const selectedStation = $derived(
    selectedStationId ? stations.find((station) => station.id === selectedStationId) : null,
  );
  const isPlacingStation = $derived(Boolean(selectedStation && !selectedStation.geo));

  function makeGeojson() {
    return {
      type: "FeatureCollection" as const,
      features: stations
        .filter((station) => station.geo && station.id !== selectedStationId)
        .map((station) => ({
          type: "Feature" as const,
          properties: { id: station.id, type: station.type },
          geometry: {
            type: "Point" as const,
            coordinates: [station.geo!.lng, station.geo!.lat],
          },
        })),
    };
  }

  function syncSource() {
    if (!map || !loaded) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (source) source.setData(makeGeojson());
  }

  function syncMarker() {
    if (!map || !loaded) return;
    marker?.remove();
    marker = null;

    if (!selectedStation?.geo) return;

    const element = document.createElement("div");
    element.className = "size-5 cursor-grab rounded-full border-2 border-white shadow-lg";
    element.style.backgroundColor =
      STATION_TYPE_COLOR[selectedStation.type] ?? STATION_TYPE_COLOR.rail;

    marker = new maplibregl.Marker({
      element,
      draggable: true,
      anchor: "center",
    })
      .setLngLat([selectedStation.geo.lng, selectedStation.geo.lat])
      .addTo(map);

    marker.on("dragend", () => {
      const lngLat = marker?.getLngLat();
      if (!lngLat || !selectedStationId) return;
      onMarkerDragEnd(
        selectedStationId,
        Math.round(lngLat.lat * 1e6) / 1e6,
        Math.round(lngLat.lng * 1e6) / 1e6,
      );
    });

    map.flyTo({
      center: [selectedStation.geo.lng, selectedStation.geo.lat],
      zoom: Math.max(map.getZoom(), SELECTED_STATION_ZOOM),
      duration: 500,
    });
  }

  $effect(() => {
    if (!loaded && stations.length === 0 && selectedStationId === null) return;
    syncSource();
    syncMarker();
  });

  $effect(() => {
    if (map) map.getCanvas().style.cursor = isAddingStation || isPlacingStation ? "crosshair" : "";
  });

  onMount(() => {
    map = new maplibregl.Map({
      container: container!,
      style: "https://tiles.openfreemap.org/styles/dark",
      center: [12, 50],
      zoom: 4,
      maxPitch: 0,
      minZoom: 1,
      maxZoom: 18,
      attributionControl: false,
    });

    map.on("styleimagemissing", (event) => {
      if (!map || map.hasImage(event.id)) return;
      map.addImage(event.id, { width: 1, height: 1, data: new Uint8Array(4) });
    });

    map.on("load", () => {
      if (!map) return;
      map.addSource(SOURCE_ID, { type: "geojson", data: makeGeojson() });
      map.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 4, 10, 6, 15, 8],
          "circle-color": [
            "match",
            ["get", "type"],
            "rail",
            STATION_TYPE_COLOR.rail,
            "metro",
            STATION_TYPE_COLOR.metro,
            "light",
            STATION_TYPE_COLOR.light,
            STATION_TYPE_COLOR.rail,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });

      map.on("mouseenter", LAYER_ID, () => {
        if (map && !isAddingStation && !isPlacingStation) map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", LAYER_ID, () => {
        if (map) {
          map.getCanvas().style.cursor = isAddingStation || isPlacingStation ? "crosshair" : "";
        }
      });

      loaded = true;
      syncMarker();
    });

    map.on("click", (event) => {
      if (!map) return;
      const features = map.queryRenderedFeatures(event.point, {
        layers: [LAYER_ID],
      });
      const id = features[0]?.properties?.id;
      if (id && !isAddingStation && !isPlacingStation) {
        onSelectStation(String(id));
        return;
      }

      const lat = Math.round(event.lngLat.lat * 1e6) / 1e6;
      const lng = Math.round(event.lngLat.lng * 1e6) / 1e6;
      if (isAddingStation) onMapClick(lat, lng);
      else if (isPlacingStation) onSetStationLocation(lat, lng);
    });
  });

  onDestroy(() => {
    marker?.remove();
    map?.remove();
  });
</script>

<div class="relative h-full w-full">
  <div bind:this={container} class="h-full w-full"></div>

  <div
    class="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-md border border-border bg-card/90 px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground shadow-sm backdrop-blur"
  >
    <div class="text-[10px] uppercase tracking-wider text-muted-foreground/70">Legend</div>
    <div class="flex items-center gap-2">
      <span class="size-2 rounded-full" style:background-color={STATION_TYPE_COLOR.rail}></span>
      <span>Rail</span>
    </div>
    <div class="flex items-center gap-2">
      <span class="size-2 rounded-full" style:background-color={STATION_TYPE_COLOR.metro}></span>
      <span>Metro</span>
    </div>
    <div class="flex items-center gap-2">
      <span class="size-2 rounded-full" style:background-color={STATION_TYPE_COLOR.light}></span>
      <span>Light rail</span>
    </div>
  </div>

  {#if isAddingStation || isPlacingStation}
    <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div class="rounded-md bg-black/75 px-4 py-2 text-sm text-white">
        {isAddingStation
          ? "Click on the map to place the new station"
          : "Click on the map to set location"}
      </div>
    </div>
  {/if}
</div>
