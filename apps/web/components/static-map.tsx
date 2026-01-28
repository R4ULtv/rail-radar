"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import dynamic from "next/dynamic";
import { Marker } from "react-map-gl/maplibre";
import { MapPinIcon } from "lucide-react";

const MapGL = dynamic(
  () => import("react-map-gl/maplibre").then((mod) => mod.Map),
  { ssr: false },
);

interface StaticMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
}

export function StaticMap({ lat, lng, zoom = 14, className }: StaticMapProps) {
  return (
    <div className={className}>
      <MapGL
        initialViewState={{
          latitude: lat,
          longitude: lng,
          zoom,
          bearing: 0,
          pitch: 0,
        }}
        interactive={false}
        attributionControl={false}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://tiles-eu.stadiamaps.com/styles/alidade_smooth_dark.json"
      >
        <Marker latitude={lat} longitude={lng} anchor="center">
          <div className="bg-primary rounded-full p-2 shadow-lg">
            <MapPinIcon className="size-5 text-primary-foreground" />
          </div>
        </Marker>
      </MapGL>
      {/* Gradient overlay for visual appeal */}
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent pointer-events-none" />
    </div>
  );
}
