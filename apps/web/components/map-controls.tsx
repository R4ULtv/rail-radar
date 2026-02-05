"use client";

import * as React from "react";
import { Marker, useMap } from "react-map-gl/mapbox";
import {
  CompassIcon,
  LocateFixedIcon,
  LocateIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { ButtonGroup } from "@repo/ui/components/button-group";
import { GitHub } from "@repo/ui/icons/github";

export function MapControls() {
  const { current: map } = useMap();
  const [bearing, setBearing] = React.useState(0);
  const [userLocation, setUserLocation] = React.useState<{
    longitude: number;
    latitude: number;
  } | null>(null);

  React.useEffect(() => {
    if (!map) return;

    const handleRotate = () => {
      setBearing(map.getBearing());
    };

    map.on("rotate", handleRotate);
    return () => {
      map.off("rotate", handleRotate);
    };
  }, [map]);

  React.useEffect(() => {
    if (!navigator.geolocation || !navigator.permissions) return;

    // Only get location on mount if permission is already granted (don't prompt)
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        if (result.state === "granted") {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { longitude, latitude } = position.coords;
              setUserLocation({ longitude, latitude });
            },
            () => {
              // Error getting location - silently ignore
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 60000,
            },
          );
        }
      })
      .catch(() => {
        // Permissions API not supported or error - silently ignore
      });
  }, []);

  const handleZoomIn = React.useCallback(() => {
    map?.zoomIn();
  }, [map]);

  const handleZoomOut = React.useCallback(() => {
    map?.zoomOut();
  }, [map]);

  const handleLocate = React.useCallback(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        setUserLocation({ longitude, latitude });
        map?.flyTo({
          center: [longitude, latitude],
          zoom: 14,
        });
      },
      (error) => {
        console.error("Geolocation error:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  }, [map]);

  const handleResetBearing = React.useCallback(() => {
    map?.easeTo({ bearing: 0, pitch: 0 });
  }, [map]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      switch (event.key) {
        case "+":
        case "=":
          handleZoomIn();
          break;
        case "-":
          handleZoomOut();
          break;
        case "l":
        case "L":
          handleLocate();
          break;
        case "n":
        case "N":
          handleResetBearing();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleLocate, handleResetBearing]);

  return (
    <>
      {userLocation && (
        <Marker
          longitude={userLocation.longitude}
          latitude={userLocation.latitude}
          anchor="center"
        >
          <div className="relative flex items-center justify-center">
            <div className="absolute rounded-full bg-accent/20 size-8" />
            <div
              className="absolute rounded-full bg-accent/40 size-5 motion-safe:animate-ping"
              style={{ animationDuration: "2s" }}
            />
            <div className="size-4 rounded-full border-2 border-white bg-accent shadow-md z-10" />
          </div>
        </Marker>
      )}
      <div className="absolute bottom-3 right-3 flex flex-col gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleResetBearing}
          aria-label="Reset bearing"
          className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted size-9 md:size-8"
        >
          <CompassIcon
            style={{ transform: `rotate(${-bearing - 45}deg)` }}
            className="transition-transform"
          />
        </Button>

        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleLocate}
          aria-label="Locate me"
          className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted size-9 md:size-8"
        >
          {userLocation ? <LocateFixedIcon /> : <LocateIcon />}
        </Button>

        <ButtonGroup orientation="vertical" className="hidden md:flex">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleZoomIn}
            aria-label="Zoom in"
            className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted"
          >
            <PlusIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleZoomOut}
            aria-label="Zoom out"
            className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted"
          >
            <MinusIcon />
          </Button>
        </ButtonGroup>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="GitHub"
          className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted size-9 md:size-8"
          nativeButton={false}
          render={
            <a
              href="https://github.com/R4ULtv/rail-radar"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitHub />
            </a>
          }
        />
      </div>
    </>
  );
}
