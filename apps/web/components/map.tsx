"use client";

import dynamic from "next/dynamic";
import "maplibre-gl/dist/maplibre-gl.css";

import { MapControls } from "@/components/map-controls";

const MapGL = dynamic(
  () => import("react-map-gl/maplibre").then((mod) => mod.Map),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center gap-2">
        <div className="size-2 bg-accent rounded-full animate-pulse" />
        <div className="size-2 bg-accent rounded-full animate-pulse [animation-delay:0.2s]" />
        <div className="size-2 bg-accent rounded-full animate-pulse [animation-delay:0.4s]" />
      </div>
    ),
  },
);

export function Map() {
  return (
    <MapGL
      attributionControl={false}
      initialViewState={{
        longitude: 12.5,
        latitude: 42.5,
        zoom: 5,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle="https://tiles-eu.stadiamaps.com/styles/alidade_smooth_dark.json"
      maxPitch={0}
    >
      <MapControls />
    </MapGL>
  );
}
