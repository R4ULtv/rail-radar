"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import dynamic from "next/dynamic";
import { Marker } from "react-map-gl/maplibre";

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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 512 512"
          >
            <path
              d="M488 152v208c0 70.645-57.355 128-128 128H152c-70.645 0-128-57.355-128-128V152C24 81.355 81.355 24 152 24h208c70.645 0 128 57.355 128 128Z"
              fill="#d14b4b"
              stroke="#fff"
              strokeWidth="29"
            />
            <g
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="matrix(14.66667 0 0 14.66667 80 80)"
            >
              <path d="M8 3.1V7c0 2.194 1.806 4 4 4s4-1.806 4-4V3.1M9 15l-1-1M15 15l1-1" />
              <path d="M9 19c-2.8 0-5-2.2-5-5v-4c0-4.389 3.611-8 8-8 4.389 0 8 3.611 8 8v4c0 2.8-2.2 5-5 5H9ZM8 19l-2 3M16 19l2 3" />
            </g>
          </svg>
        </Marker>
      </MapGL>
      {/* Gradient overlay for visual appeal */}
      <div className="absolute inset-0 bg-linear-to-t from-background/70 via-background/30 via-25% to-transparent to-80% pointer-events-none" />
    </div>
  );
}
