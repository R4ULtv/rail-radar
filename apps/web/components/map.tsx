"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import dynamic from "next/dynamic";
import { parseAsFloat, useQueryStates } from "nuqs";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { MapEvent, ViewStateChangeEvent } from "react-map-gl/mapbox";

import { MapControls } from "@/components/map-controls";
import { MapLayerFilter } from "@/components/map-layer-filter";
import MapLoading from "@/components/map-loading";
import { Search } from "@/components/search";
import StationInfo from "@/components/station-info";
import { StationMarkers } from "@/components/station-markers";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { useMapLayers } from "@/hooks/use-map-layers";
import { SelectedStationProvider } from "@/hooks/use-selected-station";

const MapGL = dynamic(() => import("react-map-gl/mapbox").then((mod) => mod.Map), {
  ssr: false,
  loading: () => <MapLoading />,
});

const DEFAULT_VIEW = {
  lat: 50,
  lng: 12,
  zoom: 4,
};

const LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 30000,
};

type InitialPosition = {
  latitude: number;
  longitude: number;
  zoom: number;
};

export function Map() {
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

  const [initialPosition, setInitialPosition] = useState<InitialPosition>(() => ({
    latitude: params.lat,
    longitude: params.lng,
    zoom: params.zoom,
  }));
  const mapRef = useRef<MapboxMap | null>(null);
  const hasUserInteractedRef = useRef(false);
  const pendingAutoLocationRef = useRef<InitialPosition | null>(null);

  useEffect(() => {
    if (hasUrlParams || !navigator.geolocation) return;

    let cancelled = false;

    const updateFromPosition = (pos: GeolocationPosition) => {
      if (cancelled || hasUserInteractedRef.current) return;

      const latitude = Math.round(pos.coords.latitude * 1000000) / 1000000;
      const longitude = Math.round(pos.coords.longitude * 1000000) / 1000000;
      const nextPosition = { latitude, longitude, zoom: 13 };

      setInitialPosition(nextPosition);
      setParams({ lat: latitude, lng: longitude, zoom: 13 });

      if (mapRef.current) {
        mapRef.current.jumpTo({ center: [longitude, latitude], zoom: 13 });
      } else {
        pendingAutoLocationRef.current = nextPosition;
      }
    };

    const requestGrantedLocation = () => {
      navigator.geolocation.getCurrentPosition(
        updateFromPosition,
        () => {
          // Location failures should not block the default map load.
        },
        LOCATION_OPTIONS,
      );
    };

    if (!navigator.permissions) {
      requestGrantedLocation();
      return () => {
        cancelled = true;
      };
    }

    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        if (result.state === "granted" || result.state === "prompt") requestGrantedLocation();
      })
      .catch(() => {
        // Permissions API failures should not block the default map load.
      });

    return () => {
      cancelled = true;
    };
  }, [hasUrlParams, setParams]);

  const handleMoveEnd = useCallback(
    (e: ViewStateChangeEvent) => {
      startTransition(() => {
        setParams({
          lat: Math.round(e.viewState.latitude * 1000000) / 1000000,
          lng: Math.round(e.viewState.longitude * 1000000) / 1000000,
          zoom: Math.round(e.viewState.zoom * 10) / 10,
        });
      });
    },
    [setParams],
  );

  const handleMapLoad = useCallback((event: MapEvent) => {
    mapRef.current = event.target;
    const pendingAutoLocation = pendingAutoLocationRef.current;

    if (pendingAutoLocation && !hasUserInteractedRef.current) {
      event.target.jumpTo({
        center: [pendingAutoLocation.longitude, pendingAutoLocation.latitude],
        zoom: pendingAutoLocation.zoom,
      });
      pendingAutoLocationRef.current = null;
    }
  }, []);

  const handleUserInteraction = useCallback(() => {
    hasUserInteractedRef.current = true;
  }, []);

  const { stations, layers, toggleStation, toggleLayer } = useMapLayers();

  return (
    <MapGL
      initialViewState={{
        ...initialPosition,
        bearing: 0,
        pitch: 0,
      }}
      onMoveEnd={handleMoveEnd}
      attributionControl={false}
      style={{
        width: "100%",
        height: "100%",
      }}
      onLoad={handleMapLoad}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      mapStyle="mapbox://styles/mapbox/dark-v11?optimize=true"
      projection="mercator"
      maxPitch={0}
      minZoom={3}
      maxZoom={18}
      performanceMetricsCollection={false}
      reuseMaps
      onDragStart={handleUserInteraction}
      onZoomStart={handleUserInteraction}
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
        <MapControls />
        <StationInfo />
        <AnnouncementBanner />
      </SelectedStationProvider>
    </MapGL>
  );
}
