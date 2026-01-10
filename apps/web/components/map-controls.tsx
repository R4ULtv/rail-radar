"use client";

import * as React from "react";
import { Marker, useMap } from "react-map-gl/maplibre";
import {
  CompassIcon,
  LocateFixedIcon,
  LocateIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { useIsMobile } from "@/hooks/use-mobile";

export function MapControls() {
  const isMobile = useIsMobile();
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
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        setUserLocation({ longitude, latitude });
      },
      () => {
        // Permission denied or error - silently ignore
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
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
            <div className="absolute size-7 rounded-full bg-accent/30 motion-safe:animate-pulse" />
            <div className="size-3.5 rounded-full border-2 border-white bg-accent shadow-md" />
          </div>
        </Marker>
      )}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <Button
          variant="outline"
          size={isMobile ? "icon-lg" : "icon-sm"}
          onClick={handleResetBearing}
          aria-label="Reset bearing"
          className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted"
        >
          <CompassIcon
            style={{ transform: `rotate(${-bearing - 45}deg)` }}
            className="transition-transform"
          />
        </Button>

        <Button
          variant="outline"
          size={isMobile ? "icon-lg" : "icon-sm"}
          onClick={handleLocate}
          aria-label="Locate me"
          className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted"
        >
          {userLocation ? <LocateFixedIcon /> : <LocateIcon />}
        </Button>

        <ButtonGroup orientation="vertical" className="hidden md:flex">
          <Button
            variant="outline"
            size={isMobile ? "icon-lg" : "icon-sm"}
            onClick={handleZoomIn}
            aria-label="Zoom in"
            className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted"
          >
            <PlusIcon />
          </Button>
          <Button
            variant="outline"
            size={isMobile ? "icon-lg" : "icon-sm"}
            onClick={handleZoomOut}
            aria-label="Zoom out"
            className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted"
          >
            <MinusIcon />
          </Button>
        </ButtonGroup>
      </div>
    </>
  );
}
