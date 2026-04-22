"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import dynamic from "next/dynamic";
import { parseAsFloat, useQueryStates } from "nuqs";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { MapRef, ViewStateChangeEvent } from "react-map-gl/mapbox";

import type { MapContextMenuSnapshot } from "@/components/map-context-menu";
import { MapControls } from "@/components/map-controls";
import { MapLayerFilter } from "@/components/map-layer-filter";
import MapLoading from "@/components/map-loading";
import { Search } from "@/components/search";
import StationInfo from "@/components/station-info";
import {
  STATION_LAYER_IDS,
  StationMarkers,
  stationFromFeature,
} from "@/components/station-markers";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { useMapLayers } from "@/hooks/use-map-layers";
import { SelectedStationProvider } from "@/hooks/use-selected-station";
import { ContextMenu, ContextMenuTrigger } from "@repo/ui/components/context-menu";

const MapGL = dynamic(() => import("react-map-gl/mapbox").then((mod) => mod.Map), {
  ssr: false,
  loading: () => <MapLoading />,
});

const DEFAULT_VIEW = {
  lat: 50,
  lng: 12,
  zoom: 4,
};

export function Map() {
  const mapRef = useRef<MapRef>(null);
  const [contextMenuSnapshot, setContextMenuSnapshot] = useState<MapContextMenuSnapshot | null>(
    null,
  );
  const [params, setParams] = useQueryStates(
    {
      lat: parseAsFloat.withDefault(DEFAULT_VIEW.lat),
      lng: parseAsFloat.withDefault(DEFAULT_VIEW.lng),
      zoom: parseAsFloat.withDefault(DEFAULT_VIEW.zoom),
    },
    {
      history: "replace",
      shallow: true,
    },
  );

  const hasUrlParams =
    params.lat !== DEFAULT_VIEW.lat ||
    params.lng !== DEFAULT_VIEW.lng ||
    params.zoom !== DEFAULT_VIEW.zoom;

  const [initialPosition, setInitialPosition] = useState<{
    latitude: number;
    longitude: number;
    zoom: number;
  } | null>(
    hasUrlParams ? { latitude: params.lat, longitude: params.lng, zoom: params.zoom } : null,
  );

  const hasInitialPosition = initialPosition !== null;

  useEffect(() => {
    if (hasUrlParams || hasInitialPosition) return;

    const setDefaultPosition = () => {
      setInitialPosition({
        latitude: DEFAULT_VIEW.lat,
        longitude: DEFAULT_VIEW.lng,
        zoom: DEFAULT_VIEW.zoom,
      });
    };

    if (navigator.permissions && navigator.geolocation) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((result) => {
          if (result.state === "granted") {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const latitude = Math.round(pos.coords.latitude * 1000000) / 1000000;
                const longitude = Math.round(pos.coords.longitude * 1000000) / 1000000;
                setInitialPosition({ latitude, longitude, zoom: 13 });
                setParams({ lat: latitude, lng: longitude, zoom: 13 });
              },
              () => setDefaultPosition(),
            );
          } else {
            setDefaultPosition();
          }
        })
        .catch(() => setDefaultPosition());
    } else {
      setDefaultPosition();
    }
  }, [hasInitialPosition, hasUrlParams, setParams]);

  const handleMoveEnd = (e: ViewStateChangeEvent) => {
    startTransition(() => {
      setParams({
        lat: Math.round(e.viewState.latitude * 1000000) / 1000000,
        lng: Math.round(e.viewState.longitude * 1000000) / 1000000,
        zoom: Math.round(e.viewState.zoom * 10) / 10,
      });
    });
  };

  const handleContextMenuCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const map = mapRef.current;
    if (!map) return;

    const rect = map.getContainer().getBoundingClientRect();
    const point: [number, number] = [event.clientX - rect.left, event.clientY - rect.top];
    const lngLat = map.unproject(point);

    let station = null;
    try {
      const layers = STATION_LAYER_IDS.filter((layerId) => map.getLayer(layerId));
      station = stationFromFeature(map.queryRenderedFeatures(point, { layers })[0]);
    } catch {
      station = null;
    }

    setContextMenuSnapshot({
      lat: Math.round(lngLat.lat * 1000000) / 1000000,
      lng: Math.round(lngLat.lng * 1000000) / 1000000,
      station,
    });
  }, []);

  const handleContextMenuOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setContextMenuSnapshot(null);
    }
  }, []);

  const { stations, layers, toggleStation, toggleLayer } = useMapLayers();

  if (!initialPosition) {
    return <MapLoading />;
  }

  return (
    <ContextMenu onOpenChange={handleContextMenuOpenChange}>
      <ContextMenuTrigger
        className="block h-full w-full"
        onContextMenuCapture={handleContextMenuCapture}
      >
        <MapGL
          ref={mapRef}
          initialViewState={{
            ...initialPosition,
            bearing: 0,
            pitch: 0,
          }}
          onMoveEnd={handleMoveEnd}
          interactiveLayerIds={STATION_LAYER_IDS}
          attributionControl={false}
          style={{
            width: "100%",
            height: "100%",
          }}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          projection="mercator"
          maxPitch={0}
          minZoom={3}
          maxZoom={18}
        >
          <SelectedStationProvider>
            <StationMarkers stations={stations} layers={layers} />
            <Search hiddenStationTypes={stations} />
            <MapLayerFilter
              stations={stations}
              layers={layers}
              onToggleStation={toggleStation}
              onToggleLayer={toggleLayer}
            />
            <MapControls contextMenuSnapshot={contextMenuSnapshot} />
            <StationInfo />
            <AnnouncementBanner />
          </SelectedStationProvider>
        </MapGL>
      </ContextMenuTrigger>
    </ContextMenu>
  );
}
