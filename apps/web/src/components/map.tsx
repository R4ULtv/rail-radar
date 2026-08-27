"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { ClientOnly } from "@tanstack/react-router";
import { startTransition, useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { Map as MapGL, type MapEvent, type ViewStateChangeEvent } from "react-map-gl/mapbox";

import { AnnouncementBanner } from "@/components/announcement-banner";
import { MapControls } from "@/components/map-controls";
import MapLoading from "@/components/map-loading";
import { Search } from "@/components/search";
import StationInfo from "@/components/station-info";
import { StationMarkers } from "@/components/station-markers";
import { SelectedStationProvider } from "@/hooks/use-selected-station";
import { useHomeSearch } from "@/hooks/use-home-search";
import { env } from "@/lib/env";
import { loadLastUserLocation, saveLastUserLocation, type UserLocation } from "@/lib/user-location";

const DEFAULT_VIEW = {
  lat: 50,
  lng: 12,
  zoom: 4,
};

const LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 0,
};

function isMapRoute() {
  return window.location.pathname === "/";
}

type InitialPosition = {
  latitude: number;
  longitude: number;
  zoom: number;
};

type MapState = {
  initialPosition: InitialPosition;
  userLocation: UserLocation | null;
};

type MapAction =
  | {
      type: "setAutoLocation";
      position: InitialPosition;
    }
  | {
      type: "setUserLocation";
      location: UserLocation;
    };

function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case "setAutoLocation":
      return {
        initialPosition: action.position,
        userLocation: {
          latitude: action.position.latitude,
          longitude: action.position.longitude,
        },
      };
    case "setUserLocation":
      return {
        ...state,
        userLocation: action.location,
      };
    default:
      return state;
  }
}

function MapConfigurationError() {
  return (
    <div className="bg-background flex h-full w-full items-center justify-center px-6 text-center">
      <div className="max-w-md space-y-2">
        <p className="text-lg font-medium">The map is not configured</p>
        <p className="text-muted-foreground text-sm">
          Set <code className="text-foreground font-mono">VITE_MAPBOX_TOKEN</code> in the web app
          environment, then reload the page.
        </p>
      </div>
    </div>
  );
}

function MapLoadError() {
  return (
    <div className="bg-background flex h-full w-full items-center justify-center px-6 text-center">
      <div className="max-w-md space-y-2">
        <p className="text-lg font-medium">The map could not be loaded</p>
        <p className="text-muted-foreground text-sm">
          Check that <code className="text-foreground font-mono">VITE_MAPBOX_TOKEN</code> is valid
          and allowed for this origin, then reload the page.
        </p>
      </div>
    </div>
  );
}

export function Map() {
  return (
    <ClientOnly fallback={<MapLoading />}>
      {env.mapboxToken ? <ConfiguredMap /> : <MapConfigurationError />}
    </ClientOnly>
  );
}

function ConfiguredMap() {
  const { search, setSearch } = useHomeSearch();
  const params = {
    lat: search.lat ?? DEFAULT_VIEW.lat,
    lng: search.lng ?? DEFAULT_VIEW.lng,
    zoom: search.zoom ?? DEFAULT_VIEW.zoom,
  };

  const hasUrlParams =
    search.lat !== undefined || search.lng !== undefined || search.zoom !== undefined;
  const [hasInitialUrlParams] = useState(hasUrlParams);

  const [{ initialPosition, userLocation }, dispatch] = useReducer(mapReducer, null, () => {
    const lastUserLocation = loadLastUserLocation();

    return {
      initialPosition:
        !hasInitialUrlParams && lastUserLocation
          ? { ...lastUserLocation, zoom: 13 }
          : {
              latitude: params.lat,
              longitude: params.lng,
              zoom: params.zoom,
            },
      userLocation: lastUserLocation,
    };
  });
  const mapRef = useRef<MapboxMap | null>(null);
  const hasUserInteractedRef = useRef(false);
  const pendingAutoLocationRef = useRef<InitialPosition | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [hasMapLoadError, setHasMapLoadError] = useState(false);
  const [isAutoLocating, setIsAutoLocating] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;

    let cancelled = false;

    const updateFromPosition = (pos: GeolocationPosition) => {
      if (cancelled) return;
      setIsAutoLocating(false);
      if (!isMapRoute()) return;

      const latitude = Math.round(pos.coords.latitude * 1000000) / 1000000;
      const longitude = Math.round(pos.coords.longitude * 1000000) / 1000000;
      const location = { latitude, longitude };
      const nextPosition = { latitude, longitude, zoom: 13 };

      saveLastUserLocation(location);

      if (hasInitialUrlParams || hasUserInteractedRef.current) {
        dispatch({ type: "setUserLocation", location });
        return;
      }

      dispatch({ type: "setAutoLocation", position: nextPosition });
      void setSearch({ lat: latitude, lng: longitude, zoom: 13 });

      if (mapRef.current) {
        mapRef.current.jumpTo({ center: [longitude, latitude], zoom: 13 });
      } else {
        pendingAutoLocationRef.current = nextPosition;
      }
    };

    const requestLocation = () => {
      if (cancelled) return;
      setIsAutoLocating(true);

      navigator.geolocation.getCurrentPosition(
        updateFromPosition,
        () => {
          if (!cancelled) setIsAutoLocating(false);
          // Location failures should not block the default map load.
        },
        LOCATION_OPTIONS,
      );
    };

    if (!navigator.permissions) {
      requestLocation();
      return () => {
        cancelled = true;
      };
    }

    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        if (result.state === "granted" || (!hasInitialUrlParams && result.state === "prompt")) {
          requestLocation();
        }
      })
      .catch(() => {
        if (!hasInitialUrlParams) requestLocation();
      });

    return () => {
      cancelled = true;
    };
  }, [hasInitialUrlParams, setSearch]);

  const handleMoveEnd = useCallback(
    (e: ViewStateChangeEvent) => {
      // A station flyTo can finish after the router has navigated away. In that case,
      // syncing its final position would add map-only params to the destination URL.
      if (!isMapRoute()) return;

      startTransition(() => {
        void setSearch({
          lat: Math.round(e.viewState.latitude * 1000000) / 1000000,
          lng: Math.round(e.viewState.longitude * 1000000) / 1000000,
          zoom: Math.round(e.viewState.zoom * 10) / 10,
        });
      });
    },
    [setSearch],
  );

  const handleMapLoad = useCallback((event: MapEvent) => {
    mapRef.current = event.target;
    setHasMapLoadError(false);
    setIsMapLoaded(true);
    const pendingAutoLocation = pendingAutoLocationRef.current;

    if (pendingAutoLocation && !hasUserInteractedRef.current) {
      event.target.jumpTo({
        center: [pendingAutoLocation.longitude, pendingAutoLocation.latitude],
        zoom: pendingAutoLocation.zoom,
      });
      pendingAutoLocationRef.current = null;
    }
  }, []);

  const handleMapError = useCallback(() => {
    if (!mapRef.current) {
      setHasMapLoadError(true);
    }
  }, []);

  const handleUserInteraction = useCallback(() => {
    hasUserInteractedRef.current = true;
  }, []);

  const handleUserLocationChange = useCallback((location: UserLocation) => {
    saveLastUserLocation(location);
    dispatch({ type: "setUserLocation", location });
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {hasMapLoadError ? (
        <div className="absolute inset-0 z-10">
          <MapLoadError />
        </div>
      ) : !isMapLoaded ? (
        <div className="bg-background absolute inset-0 z-10">
          <MapLoading />
        </div>
      ) : null}
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
        onError={handleMapError}
        mapboxAccessToken={env.mapboxToken}
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
          <StationMarkers />
          <Search />
          <AnnouncementBanner />
          <MapControls
            userLocation={userLocation}
            isAutoLocating={isAutoLocating}
            onUserLocationChange={handleUserLocationChange}
          />
          <StationInfo />
        </SelectedStationProvider>
      </MapGL>
    </div>
  );
}
