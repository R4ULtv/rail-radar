"use client";

import dynamic from "next/dynamic";
import { parseAsFloat, useQueryStates } from "nuqs";
import { startTransition, useEffect, useState } from "react";
import type { ViewStateChangeEvent } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import { MapControls } from "@/components/map-controls";
import { Search } from "@/components/search";
import MapLoading from "@/components/map-loading";

const MapGL = dynamic(
  () => import("react-map-gl/maplibre").then((mod) => mod.Map),
  {
    ssr: false,
    loading: () => <MapLoading />,
  },
);

const DEFAULT_VIEW = {
  lat: 42.5,
  lng: 12.5,
  zoom: 5,
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

  const [initialPosition, setInitialPosition] = useState<{
    latitude: number;
    longitude: number;
    zoom: number;
  } | null>(
    hasUrlParams
      ? { latitude: params.lat, longitude: params.lng, zoom: params.zoom }
      : null,
  );

  useEffect(() => {
    if (hasUrlParams || initialPosition) return;

    const timeout = setTimeout(() => {
      setInitialPosition({
        latitude: DEFAULT_VIEW.lat,
        longitude: DEFAULT_VIEW.lng,
        zoom: DEFAULT_VIEW.zoom,
      });
    }, 3000);

    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        clearTimeout(timeout);
        const latitude = Math.round(pos.coords.latitude * 1000000) / 1000000;
        const longitude = Math.round(pos.coords.longitude * 1000000) / 1000000;
        setInitialPosition({ latitude, longitude, zoom: 12 });
        setParams({ lat: latitude, lng: longitude, zoom: 12 });
      },
      () => {
        clearTimeout(timeout);
        setInitialPosition({
          latitude: DEFAULT_VIEW.lat,
          longitude: DEFAULT_VIEW.lng,
          zoom: DEFAULT_VIEW.zoom,
        });
      },
    );

    return () => clearTimeout(timeout);
  }, [hasUrlParams, initialPosition]);

  const handleMoveEnd = (e: ViewStateChangeEvent) => {
    startTransition(() => {
      setParams({
        lat: Math.round(e.viewState.latitude * 1000000) / 1000000,
        lng: Math.round(e.viewState.longitude * 1000000) / 1000000,
        zoom: Math.round(e.viewState.zoom * 10) / 10,
      });
    });
  };

  if (!initialPosition) {
    return <MapLoading />;
  }

  return (
    <MapGL
      initialViewState={{
        ...initialPosition,
        bearing: 0,
        pitch: 0,
      }}
      onMoveEnd={handleMoveEnd}
      attributionControl={false}
      style={{ width: "100%", height: "100%" }}
      mapStyle="https://tiles-eu.stadiamaps.com/styles/alidade_smooth_dark.json"
      maxPitch={0}
      minZoom={1}
      maxZoom={18}
    >
      <Search />
      <MapControls />
    </MapGL>
  );
}
