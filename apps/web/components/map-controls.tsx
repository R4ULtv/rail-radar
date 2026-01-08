"use client";

import { useCallback, useEffect, useState } from "react";
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

export function MapControls() {
  const { current: map } = useMap();
  const [bearing, setBearing] = useState(0);
  const [userLocation, setUserLocation] = useState<{
    longitude: number;
    latitude: number;
  } | null>(null);

  useEffect(() => {
    if (!map) return;

    const handleRotate = () => {
      setBearing(map.getBearing());
    };

    map.on("rotate", handleRotate);
    return () => {
      map.off("rotate", handleRotate);
    };
  }, [map]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        setUserLocation({ longitude, latitude });
      },
      () => {
        // Permission denied or error - silently ignore
      },
    );
  }, []);

  const handleZoomIn = useCallback(() => {
    map?.zoomIn();
  }, [map]);

  const handleZoomOut = useCallback(() => {
    map?.zoomOut();
  }, [map]);

  const handleLocate = useCallback(() => {
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
    );
  }, [map]);

  const handleResetBearing = useCallback(() => {
    map?.easeTo({ bearing: 0, pitch: 0 });
  }, [map]);

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
        <ButtonGroup
          orientation="vertical"
          className="bg-background rounded-md"
        >
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleResetBearing}
            aria-label="Reset bearing"
          >
            <CompassIcon
              style={{ transform: `rotate(${-bearing - 45}deg)` }}
              className="transition-transform"
            />
          </Button>
        </ButtonGroup>

        <ButtonGroup
          orientation="vertical"
          className="bg-background rounded-md"
        >
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleLocate}
            aria-label="Locate me"
          >
            {userLocation ? <LocateFixedIcon /> : <LocateIcon />}
          </Button>
        </ButtonGroup>

        <ButtonGroup
          orientation="vertical"
          className="bg-background rounded-md"
        >
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleZoomIn}
            aria-label="Zoom in"
          >
            <PlusIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleZoomOut}
            aria-label="Zoom out"
          >
            <MinusIcon />
          </Button>
        </ButtonGroup>
      </div>
    </>
  );
}
