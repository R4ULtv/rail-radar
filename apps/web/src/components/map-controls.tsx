import * as React from "react";
import { Marker, useMap } from "react-map-gl/mapbox";
import { CompassIcon, LocateFixedIcon, LocateIcon, MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { ButtonGroup } from "@repo/ui/components/button-group";

const LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 30000,
};

function getGeolocationErrorMessage(error: GeolocationPositionError) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission was denied.";
    case error.POSITION_UNAVAILABLE:
      return "Location is currently unavailable.";
    case error.TIMEOUT:
      return "Location request timed out.";
    default:
      return error.message || "Location request failed.";
  }
}

type UserLocation = {
  longitude: number;
  latitude: number;
};

type MapControlsProps = {
  userLocation: UserLocation | null;
  onUserLocationChange: (location: UserLocation) => void;
};

export function MapControls({ userLocation, onUserLocationChange }: MapControlsProps) {
  const { current: map } = useMap();
  const [bearing, setBearing] = React.useState(0);
  const [isLocating, setIsLocating] = React.useState(false);

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

  const handleZoomIn = React.useCallback(() => {
    map?.zoomIn();
  }, [map]);

  const handleZoomOut = React.useCallback(() => {
    map?.zoomOut();
  }, [map]);

  const fetchLocation = React.useCallback(
    (flyTo = false) => {
      if (!navigator.geolocation) return;

      if (flyTo) setIsLocating(true);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          onUserLocationChange({ longitude, latitude });
          setIsLocating(false);
          if (flyTo) {
            map?.flyTo({ center: [longitude, latitude], zoom: 14 });
          }
        },
        (error) => {
          setIsLocating(false);
          if (flyTo) {
            console.info("Geolocation unavailable:", getGeolocationErrorMessage(error));
          }
        },
        LOCATION_OPTIONS,
      );
    },
    [map, onUserLocationChange],
  );

  const handleLocate = React.useCallback(() => {
    fetchLocation(true);
  }, [fetchLocation]);

  React.useEffect(() => {
    if (!navigator.geolocation || !navigator.permissions) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        if (result.state === "granted") {
          fetchLocation();
          intervalId = setInterval(fetchLocation, 30000);
        }
      })
      .catch(() => {
        // Permissions API not supported or error - silently ignore
      });

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchLocation]);

  const handleResetBearing = React.useCallback(() => {
    map?.easeTo({ bearing: 0, pitch: 0 });
  }, [map]);

  const handleKeyboardShortcut = React.useEffectEvent((event: KeyboardEvent) => {
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
  });

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      handleKeyboardShortcut(event);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {userLocation && (
        <Marker longitude={userLocation.longitude} latitude={userLocation.latitude} anchor="center">
          <div className="relative flex items-center justify-center">
            <div className="absolute rounded-full bg-accent/20 size-8" />
            <div className="absolute rounded-full bg-accent/40 size-5 motion-safe:animate-ping" />
            <div className="size-4 rounded-full border-2 border-white bg-accent shadow-md z-10" />
          </div>
        </Marker>
      )}
      <div className="absolute bottom-4 right-4 z-30 flex flex-col gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleResetBearing}
          aria-label="Reset bearing"
          className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted size-9 md:size-8 active:scale-[0.98]"
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
          aria-busy={isLocating}
          className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted size-9 md:size-8 active:scale-[0.98]"
        >
          {userLocation || isLocating ? (
            <LocateFixedIcon className={isLocating ? "motion-safe:animate-pulse" : undefined} />
          ) : (
            <LocateIcon />
          )}
        </Button>

        <ButtonGroup orientation="vertical" className="hidden md:flex">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleZoomIn}
            aria-label="Zoom in"
            className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted active:scale-[0.98]"
          >
            <PlusIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handleZoomOut}
            aria-label="Zoom out"
            className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted active:scale-[0.98]"
          >
            <MinusIcon />
          </Button>
        </ButtonGroup>
      </div>
    </>
  );
}
