"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import { ClientOnly } from "@tanstack/react-router";
import {
  lazy,
  startTransition,
  Suspense,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import type { MapEvent, ViewStateChangeEvent } from "react-map-gl/mapbox";

// import { AnnouncementBanner } from "@/components/announcement-banner";
import { MapControls } from "@/components/map-controls";
import MapLoading from "@/components/map-loading";
import { Search } from "@/components/search";
import StationInfo from "@/components/station-info";
import { StationMarkers } from "@/components/station-markers";
import { SelectedStationProvider } from "@/hooks/use-selected-station";
import { useHomeSearch } from "@/hooks/use-home-search";
import { env } from "@/lib/env";

const MapGL = lazy(() => import("react-map-gl/mapbox").then((module) => ({ default: module.Map })));

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

function isMapRoute() {
  return window.location.pathname === "/";
}

type InitialPosition = {
  latitude: number;
  longitude: number;
  zoom: number;
};

type UserLocation = {
  latitude: number;
  longitude: number;
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

export function Map() {
  const { search, setSearch } = useHomeSearch();
  const params = {
    lat: search.lat ?? DEFAULT_VIEW.lat,
    lng: search.lng ?? DEFAULT_VIEW.lng,
    zoom: search.zoom ?? DEFAULT_VIEW.zoom,
  };

  const hasUrlParams =
    params.lat !== DEFAULT_VIEW.lat ||
    params.lng !== DEFAULT_VIEW.lng ||
    params.zoom !== DEFAULT_VIEW.zoom;

  const [{ initialPosition, userLocation }, dispatch] = useReducer(mapReducer, null, () => ({
    initialPosition: {
      latitude: params.lat,
      longitude: params.lng,
      zoom: params.zoom,
    },
    userLocation: null,
  }));
  const mapRef = useRef<MapboxMap | null>(null);
  const hasUserInteractedRef = useRef(false);
  const pendingAutoLocationRef = useRef<InitialPosition | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  useEffect(() => {
    if (hasUrlParams || !navigator.geolocation) return;

    let cancelled = false;

    const updateFromPosition = (pos: GeolocationPosition) => {
      if (cancelled || hasUserInteractedRef.current || !isMapRoute()) return;

      const latitude = Math.round(pos.coords.latitude * 1000000) / 1000000;
      const longitude = Math.round(pos.coords.longitude * 1000000) / 1000000;
      const nextPosition = { latitude, longitude, zoom: 13 };

      dispatch({ type: "setAutoLocation", position: nextPosition });
      void setSearch({ lat: latitude, lng: longitude, zoom: 13 });

      if (mapRef.current) {
        mapRef.current.jumpTo({ center: [longitude, latitude], zoom: 13 });
      } else {
        pendingAutoLocationRef.current = nextPosition;
      }
    };

    const requestLocation = () => {
      navigator.geolocation.getCurrentPosition(
        updateFromPosition,
        () => {
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
        const shouldPromptForLocationOnLoad = true;

        if (
          result.state === "granted" ||
          (shouldPromptForLocationOnLoad && result.state === "prompt")
        ) {
          requestLocation();
        }
      })
      .catch(() => {
        // Permissions API failures should not block the default map load.
      });

    return () => {
      cancelled = true;
    };
  }, [hasUrlParams, setSearch]);

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

  const handleUserInteraction = useCallback(() => {
    hasUserInteractedRef.current = true;
  }, []);

  const handleUserLocationChange = useCallback((location: UserLocation) => {
    dispatch({ type: "setUserLocation", location });
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {!isMapLoaded && (
        <div className="bg-background absolute inset-0 z-10">
          <MapLoading />
        </div>
      )}
      <ClientOnly fallback={<MapLoading />}>
        <Suspense fallback={<MapLoading />}>
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
              {/*<AnnouncementBanner />*/}
              <MapControls
                userLocation={userLocation}
                onUserLocationChange={handleUserLocationChange}
              />
              <StationInfo />
            </SelectedStationProvider>
          </MapGL>
        </Suspense>
      </ClientOnly>
    </div>
  );
}
