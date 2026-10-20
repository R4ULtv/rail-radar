import { getStationLines } from "@repo/data/lines";
import type { Station } from "@repo/data/types";
import Mapbox from "@rnmapbox/maps";
import { StatusBar } from "expo-status-bar";
import { Alert } from "heroui-native/alert";
import { Card } from "heroui-native/card";
import { useThemeColor } from "heroui-native/hooks";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Compass,
  LocateButton,
  MapControlGroup,
  MapStyleButton,
  NearbyButton,
  SheetControls,
  TopControls,
  useIsSheetFullyOpen,
  useMapHeading,
  useSheetPosition,
  useSheetTopInset,
} from "@/components/map-controls";
import { IntroSheet, useIntro } from "@/components/intro-sheet";
import { LineSheet } from "@/components/line-sheet";
import { MapStyleSheet } from "@/components/map-style-sheet";
import { SearchSheet } from "@/components/search-sheet";
import { Settings } from "@/components/settings-sheet";
import {
  LineStops,
  LineTracks,
  RailwayLines,
  StationImages,
  StationLayers,
} from "@/components/station-markers";
import { middleStep, StationSheet } from "@/components/station-sheet";
import { StatusBarBlur } from "@/components/status-bar-blur";
import { UserLocationMarker } from "@/components/user-location-marker";
import { useIsOnline } from "@/hooks/use-is-online";
import { useLinesUrl } from "@/hooks/use-lines-url";
import { useMapTheme } from "@/hooks/use-map-theme";
import { useWebsiteLinks } from "@/hooks/use-website-links";
import { useStationsById } from "@/hooks/use-stations-by-id";
import { useStationsUrl } from "@/hooks/use-stations-url";
import { addRecentStation } from "@/hooks/use-stored-stations";
import { useUserLocation } from "@/hooks/use-user-location";
import { haptics } from "@/lib/haptics";
import {
  getInitialBranch,
  getLineBounds,
  getLineColor,
  getRouteStops,
  type Line,
} from "@/lib/lines";
import { mapFeedbackUrl, type MapPosition } from "@/lib/links";
import type { LocationFix } from "@/lib/location-tracking";
import { initialMapRecovery, reduceMapRecovery } from "@/lib/map-recovery";
import { findNearbyDepartures } from "@/lib/nearby-departures";
import { setPreference, usePreference } from "@/lib/preferences";
import {
  loadStationSearch,
  loadStations,
  loadStationsById,
  type NearbyStation,
} from "@/lib/stations";
import { loadLastUserLocation } from "@/lib/user-location";

const accessToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
const defaultCamera = { centerCoordinate: [12, 50] as [number, number], zoomLevel: 4 };
// Same zoom levels as the web: 13 when opening on the user, 14 after tapping locate.
const userZoomLevel = 13;
const locateZoomLevel = 14;
// Like the web, selecting a station zooms in on it, a little closer for metro and light rail.
const stationZoomLevels: Record<Station["type"], number> = { rail: 13, metro: 14, light: 14 };
// How far a selected station sits above the station sheet's middle step, leaving room for its label.
const stationSheetClearance = 48;
// Around a selected line, inside the map above the line sheet's middle step.
const lineBoundsPadding = 40;
// Mapbox keeps the last camera padding, so moves that should be centered have to clear it.
const noPadding = { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 };
// The nearby button's errors are about one tap, so they go away on their own.
const nearbyErrorDuration = 4000;

if (accessToken) {
  Mapbox.setAccessToken(accessToken);
}
// Mapbox's telemetry would send the user's location to Mapbox; it stays on the device instead.
// This is also the opt-out Mapbox requires, which its hidden attribution button would offer.
Mapbox.setTelemetryEnabled(false);

const noLineIds: readonly string[] = [];
const noStops: readonly Station[] = [];

// Web Mercator, as a fraction of the world's width from the top left.
const mercatorX = (lng: number) => (lng + 180) / 360;
const mercatorY = (lat: number) => {
  const sin = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
};
const inverseMercatorY = (y: number) =>
  (Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) * 360) / Math.PI - 90;
// The world is one 512pt tile at zoom 0.
const worldSize = 512;
const maxFitZoom = 15;

/**
 * The center and zoom that fit the bounds into the map, inside the padding. Mapbox's own bounds
 * fit adds the camera's current padding to the one given, so a fit after centering a station
 * above its sheet came out far too small.
 */
function fitBounds(
  [west, south, east, north]: readonly [number, number, number, number],
  width: number,
  height: number,
  padding: typeof noPadding,
) {
  const x0 = mercatorX(west);
  const x1 = mercatorX(east);
  const y0 = mercatorY(north);
  const y1 = mercatorY(south);
  const fitWidth = Math.max(width - padding.paddingLeft - padding.paddingRight, 1);
  const fitHeight = Math.max(height - padding.paddingTop - padding.paddingBottom, 1);
  const scale = Math.min(
    fitWidth / Math.max((x1 - x0) * worldSize, 1e-9),
    fitHeight / Math.max((y1 - y0) * worldSize, 1e-9),
  );
  return {
    centerCoordinate: [(west + east) / 2, inverseMercatorY((y0 + y1) / 2)],
    zoomLevel: Math.min(Math.log2(scale), maxFitZoom),
  };
}

type StationPressEvent = Parameters<
  NonNullable<ComponentProps<typeof Mapbox.ShapeSource>["onPress"]>
>[0];

interface NearbyDeparturesAction {
  stationsUrl: string | null;
  findingNearby: { current: boolean };
  hasMovedMap: { current: boolean };
  cameraAction: { current: number };
  hasUsedNearby: boolean;
  getLocation: () => Promise<LocationFix | null>;
  stopFollowing: () => void;
  selectStation: (station: Station) => void;
  setIsFindingNearby: (isFinding: boolean) => void;
  setNearbyError: (message: string | null) => void;
  setNearbyStations: (stations: NearbyStation[]) => void;
}

// Keep try/finally outside the component: the installed React Compiler otherwise skips all
// of MapScreen. Cleanup still runs on early returns, failed requests, and superseded actions.
async function findAndOpenNearbyDepartures({
  stationsUrl,
  findingNearby,
  hasMovedMap,
  cameraAction,
  hasUsedNearby,
  getLocation,
  stopFollowing,
  selectStation,
  setIsFindingNearby,
  setNearbyError,
  setNearbyStations,
}: NearbyDeparturesAction) {
  if (!stationsUrl || findingNearby.current) return;
  findingNearby.current = true;
  setIsFindingNearby(true);
  setNearbyError(null);
  haptics.tap();
  hasMovedMap.current = true;
  stopFollowing();
  const action = cameraAction.current;
  try {
    const [location, stations] = await Promise.all([getLocation(), loadStations(stationsUrl)]);
    // Panning, locating, or choosing a station while GPS loads takes precedence.
    if (action !== cameraAction.current) return;
    // The shared location hook explains why there's no location, e.g. that it's turned off.
    if (!location) {
      haptics.error();
      return;
    }
    const nearest = findNearbyDepartures(stations, location);
    if (!nearest[0]) {
      haptics.error();
      setNearbyError("No train stations found nearby. Try searching for one instead.");
      return;
    }
    selectStation(nearest[0]);
    setNearbyStations(nearest);
    if (!hasUsedNearby) {
      // Shown without its label from now on, once the sheet over it closes.
      setPreference("nearbyButtonUsed", true);
    }
  } catch {
    if (action === cameraAction.current) {
      haptics.error();
      setNearbyError("Nearby stations couldn't be loaded. Check your connection and try again.");
    }
  } finally {
    findingNearby.current = false;
    setIsFindingNearby(false);
  }
}

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const sheetTopInset = useSheetTopInset();
  // The map's own height, since Android's window height can leave out the navigation bar.
  const mapHeight = useRef(0);
  const mapWidth = useRef(0);
  const reduceMotion = useReducedMotion();
  const camera = useRef<Mapbox.Camera>(null);
  const stationsUrl = useStationsUrl();
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The open line, the station it was opened from, which its sheet goes back to, and the
  // branch it shows.
  const [selectedLine, setSelectedLine] = useState<{
    line: Line;
    fromStation: Station | null;
    branch: number;
  } | null>(null);
  const [lineSheetOpen, setLineSheetOpen] = useState(false);
  // A stop opened from the line's sheet, which goes back to the line when it's closed.
  const [stopFromLineId, setStopFromLineId] = useState<string | null>(null);
  const linesUrl = useLinesUrl();
  // The closest train stations, while the station sheet was opened from the nearby button.
  const [nearbyStations, setNearbyStations] = useState<NearbyStation[]>([]);
  const [isFindingNearby, setIsFindingNearby] = useState(false);
  const findingNearby = useRef(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const hasUsedNearby = usePreference("nearbyButtonUsed");
  const intro = useIntro();
  const isIntroOpen = intro.page !== null;
  const {
    location: userLocation,
    status: locationStatus,
    message,
    getLocation,
    locate,
  } = useUserLocation(!isIntroOpen);
  const isOnline = useIsOnline();
  const [{ failed: mapFailed, key: mapKey }, dispatchMapRecovery] = useReducer(
    reduceMapRecovery,
    isOnline,
    initialMapRecovery,
  );
  const [alertColor, backgroundColor] = useThemeColor(["danger", "background"]);
  const mapTheme = useMapTheme();
  // Station labels change color once the new map style has loaded. Changing them while it
  // loads makes Mapbox update layers that aren't in the style yet, which logs errors.
  const [labelColors, setLabelColors] = useState(mapTheme);
  const { heading, onHeadingChange } = useMapHeading();
  // The saved position only seeds the camera. Following starts explicitly with Locate.
  const [initialCamera] = useState(() => {
    const lastLocation = loadLastUserLocation();
    return lastLocation
      ? {
          centerCoordinate: [lastLocation.longitude, lastLocation.latitude] as [number, number],
          zoomLevel: userZoomLevel,
        }
      : defaultCamera;
  });
  // Once the user interacts, even a pending launch/Locate fix must not move the camera back.
  const hasMovedMap = useRef(false);
  const hasCenteredOnLaunch = useRef(false);
  const cameraAction = useRef(0);
  const lastCameraLocation = useRef<LocationFix | null>(null);
  // Kept without re-rendering, for the "Improve this map" links.
  const mapPosition = useRef<MapPosition>({
    center: initialCamera.centerCoordinate,
    zoom: initialCamera.zoomLevel,
  });
  const getMapFeedbackUrl = useCallback(() => mapFeedbackUrl(mapPosition.current), []);
  const [isFollowing, setIsFollowing] = useState(false);
  // Direction is enabled by Locate for this session, independently of camera following.
  const [showUserHeading, setShowUserHeading] = useState(false);
  const following = useRef(false);
  // Where the sheets are, for the controls that sit above them.
  const searchSheetPosition = useSheetPosition();
  const stationSheetPosition = useSheetPosition();
  const lineSheetPosition = useSheetPosition();
  // While a sheet is fully open, the strip of map above it stays still.
  const isMapLocked = useIsSheetFullyOpen([
    searchSheetPosition,
    stationSheetPosition,
    lineSheetPosition,
  ]);
  const mapStyleSheetPosition = useSheetPosition();
  const [isMapStyleOpen, setIsMapStyleOpen] = useState(false);

  // Recovery handles either ordering of the network update and native loading error.
  useEffect(() => {
    dispatchMapRecovery({ type: "connection", isOnline });
  }, [isOnline]);

  const stopFollowing = useCallback(() => {
    cameraAction.current++;
    following.current = false;
    setIsFollowing(false);
  }, []);

  // Where the sheets' middle step starts, from the top of the map.
  const getMiddleStepTop = useCallback(() => {
    const height = mapHeight.current;
    return sheetTopInset + (height - sheetTopInset) * (1 - middleStep);
  }, [sheetTopInset]);

  const centerOnStation = useCallback(
    (station: Station) => {
      if (!station.geo) return;
      // Above the station sheet's middle step, and so above its peek too. The padding stays the
      // same as the sheet changes size, so the map doesn't move with it.
      const stationY = getMiddleStepTop() - stationSheetClearance;
      camera.current?.setCamera({
        centerCoordinate: [station.geo.lng, station.geo.lat],
        zoomLevel: stationZoomLevels[station.type],
        padding: { ...noPadding, paddingBottom: Math.max(mapHeight.current - 2 * stationY, 0) },
        animationMode: "easeTo",
        animationDuration: reduceMotion ? 0 : 700,
      });
    },
    [getMiddleStepTop, reduceMotion],
  );

  const selectStation = useCallback(
    (station: Station) => {
      haptics.tap();
      hasMovedMap.current = true;
      stopFollowing();
      setNearbyStations([]);
      setNearbyError(null);
      setSelectedStation(station);
      // Opened in the same update, so the first station sheet mounts already open.
      setSheetOpen(true);
      setLineSheetOpen(false);
      setStopFromLineId(null);
      // Let the camera move start before updating the search sheet's recent list.
      setTimeout(() => addRecentStation(station), 0);
      centerOnStation(station);
    },
    [stopFollowing, centerOnStation],
  );

  // The whole line fits above the sheets' middle step, clear of the controls on top.
  const fitLine = useCallback(
    (line: Line) => {
      if (!stationsUrl) return;
      const action = cameraAction.current;
      void loadStationsById(stationsUrl)
        .then((stationsById) => {
          const bounds = getLineBounds(line, stationsById);
          // Panning, locating, or choosing something else meanwhile takes precedence.
          if (!bounds || action !== cameraAction.current) return;
          const padding = {
            paddingTop: sheetTopInset + lineBoundsPadding * 1.5,
            paddingBottom: mapHeight.current - getMiddleStepTop() + lineBoundsPadding,
            paddingLeft: lineBoundsPadding,
            paddingRight: lineBoundsPadding,
          };
          camera.current?.setCamera({
            ...fitBounds(bounds, mapWidth.current, mapHeight.current, padding),
            padding,
            animationMode: "easeTo",
            animationDuration: reduceMotion ? 0 : 700,
          });
        })
        .catch(() => {});
    },
    [stationsUrl, sheetTopInset, getMiddleStepTop, reduceMotion],
  );

  // Opening a line hides the station sheet; from a station, closing the line goes back to it.
  const selectLine = useCallback(
    (line: Line, fromStation: Station | null) => {
      haptics.tap();
      hasMovedMap.current = true;
      stopFollowing();
      setSelectedLine({
        line,
        fromStation,
        branch: getInitialBranch(line, fromStation?.id ?? null),
      });
      setLineSheetOpen(true);
      setSheetOpen(false);
      setStopFromLineId(null);
      fitLine(line);
    },
    [stopFollowing, fitLine],
  );

  const selectLineFromSearch = useCallback((line: Line) => selectLine(line, null), [selectLine]);
  const selectLineFromStation = useCallback(
    (line: Line) => selectLine(line, selectedStation),
    [selectLine, selectedStation],
  );

  // A stop opened from the line goes back to it, as the line goes back to its station.
  const selectStopFromLine = useCallback(
    (station: Station) => {
      selectStation(station);
      setStopFromLineId(station.id);
    },
    [selectStation],
  );

  const onLineSheetOpenChange = useCallback(
    (isOpen: boolean) => {
      setLineSheetOpen(isOpen);
      if (isOpen) return;
      // Even after one of its stops was opened in between.
      const fromStation = selectedLine?.fromStation;
      if (fromStation) {
        setSelectedStation(fromStation);
        setSheetOpen(true);
        centerOnStation(fromStation);
      }
    },
    [selectedLine, centerOnStation],
  );

  const onStationSheetOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) stopFollowing();
      else setNearbyStations([]);
      setSheetOpen(isOpen);
      if (isOpen || !stopFromLineId) return;
      setStopFromLineId(null);
      if (selectedLine && stopFromLineId === selectedStation?.id) {
        setLineSheetOpen(true);
        fitLine(selectedLine.line);
      }
    },
    [stopFollowing, stopFromLineId, selectedLine, selectedStation, fitLine],
  );

  const changeLineBranch = useCallback(
    (branch: number) => setSelectedLine((current) => current && { ...current, branch }),
    [],
  );

  // The open branch's stops are marked on its line, so it's clear which one the sheet lists.
  const stationsById = useStationsById(stationsUrl);
  const lineStops = useMemo(() => {
    if (!lineSheetOpen || !selectedLine || !stationsById) return noStops;
    const route = selectedLine.line.routes[selectedLine.branch];
    return route ? getRouteStops(route, stationsById) : noStops;
  }, [lineSheetOpen, selectedLine, stationsById]);

  // Only the open line's track is drawn, or those of the open station's lines.
  const visibleLineIds = useMemo(() => {
    if (lineSheetOpen && selectedLine) return [selectedLine.line.id];
    if (sheetOpen && selectedStation) {
      const stationLines = getStationLines(selectedStation.id);
      if (stationLines.length > 0) return stationLines.map((line) => line.id);
    }
    return noLineIds;
  }, [lineSheetOpen, selectedLine, sheetOpen, selectedStation]);

  const openNearbyDepartures = useCallback(
    () =>
      findAndOpenNearbyDepartures({
        stationsUrl,
        findingNearby,
        hasMovedMap,
        cameraAction,
        hasUsedNearby,
        getLocation,
        stopFollowing,
        selectStation,
        setIsFindingNearby,
        setNearbyError,
        setNearbyStations,
      }),
    [stationsUrl, getLocation, stopFollowing, selectStation, hasUsedNearby],
  );

  useEffect(() => {
    if (!nearbyError) return;
    const timeout = setTimeout(() => setNearbyError(null), nearbyErrorDuration);
    return () => clearTimeout(timeout);
  }, [nearbyError]);

  // Switching between the nearby stations keeps them, unlike choosing any other station.
  const selectNearbyStation = useCallback(
    (station: Station) => {
      selectStation(station);
      setNearbyStations(nearbyStations);
    },
    [selectStation, nearbyStations],
  );

  const handleStationPress = useCallback(
    (event: StationPressEvent) => {
      if (isMapLocked) return;
      const feature = event.features[0];
      const properties = feature?.properties;
      if (
        typeof properties?.id !== "string" ||
        typeof properties.name !== "string" ||
        !["rail", "metro", "light"].includes(properties.type)
      ) {
        return;
      }

      const [lng, lat] = feature?.geometry.type === "Point" ? feature.geometry.coordinates : [];
      selectStation({
        id: properties.id,
        name: properties.name,
        type: properties.type as Station["type"],
        importance: [1, 2, 3, 4].includes(properties.importance) ? properties.importance : 4,
        geo: typeof lat === "number" && typeof lng === "number" ? { lat, lng } : undefined,
      });
    },
    [isMapLocked, selectStation],
  );

  // A shared station or line link opens it like a search result.
  useWebsiteLinks(stationsUrl, selectStation, selectLineFromSearch);

  // Prepare the search index while the app is idle, so the first search can show results at once.
  // This also reads the stations needed by the first station sheet and shared links.
  useEffect(() => {
    if (!stationsUrl) return;
    const idle = requestIdleCallback(() => {
      loadStationSearch(stationsUrl).catch(() => {});
    });
    return () => cancelIdleCallback(idle);
  }, [stationsUrl]);

  // Updates move the camera only while following, apart from the first launch centering.
  useEffect(() => {
    if (!userLocation || isMapLocked) return;
    const centerOnLaunch = !hasCenteredOnLaunch.current && !hasMovedMap.current;
    hasCenteredOnLaunch.current = true;
    if (!following.current && !centerOnLaunch) return;
    // Locate already moves to its fix. Repeating that move in this effect would cancel
    // its zoom animation before it has finished.
    if (
      lastCameraLocation.current &&
      userLocation.timestamp <= lastCameraLocation.current.timestamp
    )
      return;
    lastCameraLocation.current = userLocation;
    camera.current?.setCamera({
      centerCoordinate: [userLocation.longitude, userLocation.latitude],
      zoomLevel: centerOnLaunch ? userZoomLevel : undefined,
      padding: noPadding,
      animationMode: "easeTo",
      animationDuration: centerOnLaunch || reduceMotion ? 0 : 700,
    });
  }, [userLocation, isMapLocked, reduceMotion]);

  useEffect(() => {
    if (locationStatus === "off") stopFollowing();
  }, [locationStatus, stopFollowing]);

  const locateUser = useCallback(async () => {
    haptics.tap();
    hasMovedMap.current = true;
    const action = ++cameraAction.current;
    const location = await locate();
    if (location) setShowUserHeading(true);
    // A station selection or pan while Locate was pending takes precedence.
    if (action !== cameraAction.current) return;
    if (!location) {
      haptics.error();
      return;
    }
    following.current = true;
    setIsFollowing(true);
    lastCameraLocation.current = location;
    camera.current?.setCamera({
      centerCoordinate: [location.longitude, location.latitude],
      zoomLevel: locateZoomLevel,
      padding: noPadding,
      animationMode: "easeTo",
      animationDuration: reduceMotion ? 0 : 700,
    });
  }, [locate, reduceMotion]);

  const resetHeading = useCallback(() => {
    haptics.tap();
    camera.current?.setCamera({ heading: 0, animationDuration: reduceMotion ? 0 : 300 });
  }, [reduceMotion]);

  if (!accessToken) {
    return (
      <View style={[styles.missingToken, { backgroundColor }]}>
        <Card style={styles.missingTokenCard}>
          <Card.Body>
            <Card.Title>Mapbox token needed</Card.Title>
            <Card.Description>
              Add EXPO_PUBLIC_MAPBOX_TOKEN to apps/mobile/.env.local, then restart Expo.
            </Card.Description>
          </Card.Body>
        </Card>
      </View>
    );
  }

  const alertMessage =
    nearbyError ??
    message ??
    (mapFailed
      ? isOnline
        ? "The map could not be loaded."
        : "You're offline. The map will load once you're back online."
      : null);

  return (
    <View
      style={[styles.screen, { backgroundColor }]}
      onLayout={(event) => {
        mapHeight.current = event.nativeEvent.layout.height;
        mapWidth.current = event.nativeEvent.layout.width;
      }}
    >
      <StatusBar style={mapTheme.statusBarStyle} />
      <Mapbox.MapView
        key={mapKey}
        style={styles.map}
        styleURL={mapTheme.styleURL}
        projection="mercator"
        pitchEnabled={false}
        scrollEnabled={!isMapLocked}
        zoomEnabled={!isMapLocked}
        rotateEnabled={!isMapLocked}
        scaleBarEnabled={false}
        // Attribution is shown in the search sheet instead, like the web footer.
        logoEnabled={false}
        attributionEnabled={false}
        onCameraChanged={(state) => {
          if (state.gestures.isGestureActive) {
            hasMovedMap.current = true;
            stopFollowing();
          }
          onHeadingChange(state.properties.heading);
          const [longitude = 0, latitude = 0] = state.properties.center;
          mapPosition.current = { center: [longitude, latitude], zoom: state.properties.zoom };
        }}
        // Missing tiles once the map is up, e.g. panning offline, aren't a failed map.
        onMapLoadingError={() => {
          dispatchMapRecovery({ type: "failed", key: mapKey });
        }}
        onDidFinishLoadingStyle={() => setLabelColors(mapTheme)}
        onDidFinishLoadingMap={() => {
          dispatchMapRecovery({ type: "loaded", key: mapKey });
        }}
      >
        <Mapbox.Camera
          ref={camera}
          defaultSettings={initialCamera}
          minZoomLevel={3}
          maxZoomLevel={18}
        />
        <StationImages />
        {mapTheme.isStreets ? (
          <Mapbox.StyleImport
            id="basemap"
            existing
            config={{
              lightPreset: mapTheme.lightPreset,
              // The station layers name the stations, and the map is always seen from above.
              showTransitLabels: false,
              show3dObjects: false,
            }}
          />
        ) : null}
        {stationsUrl ? (
          <>
            <StationLayers
              url={stationsUrl}
              labelColors={labelColors}
              onPress={handleStationPress}
            />
            {/* Mounted after the stations, so the lines' layer below them exists already. */}
            <RailwayLines isStreets={mapTheme.isStreets} />
            {linesUrl ? (
              <>
                <LineTracks url={linesUrl} lineIds={visibleLineIds} />
                <LineStops
                  stops={lineStops}
                  color={selectedLine ? getLineColor(selectedLine.line) : null}
                />
              </>
            ) : null}
          </>
        ) : null}
        {userLocation ? (
          <UserLocationMarker location={userLocation} showHeading={showUserHeading} />
        ) : null}
      </Mapbox.MapView>

      <StatusBarBlur />

      <TopControls
        sheets={[
          searchSheetPosition,
          stationSheetPosition,
          lineSheetPosition,
          mapStyleSheetPosition,
        ]}
        top={insets.top + 12}
      >
        <Settings locationStatus={locationStatus} getMapFeedbackUrl={getMapFeedbackUrl} />
      </TopControls>

      <SheetControls
        sheets={[searchSheetPosition, stationSheetPosition, lineSheetPosition]}
        overlays={[mapStyleSheetPosition]}
      >
        <Compass heading={heading} onPress={resetHeading} />
        <MapControlGroup>
          <MapStyleButton onPress={() => setIsMapStyleOpen(true)} />
          <LocateButton status={locationStatus} isCentered={isFollowing} onPress={locateUser} />
        </MapControlGroup>
      </SheetControls>

      {stationsUrl ? (
        <SheetControls
          side="left"
          sheets={[searchSheetPosition, stationSheetPosition, lineSheetPosition]}
          overlays={[mapStyleSheetPosition]}
        >
          <NearbyButton
            isLoading={isFindingNearby}
            showLabel={!hasUsedNearby}
            onPress={openNearbyDepartures}
          />
        </SheetControls>
      ) : null}

      {alertMessage ? (
        <Alert status="danger" style={[styles.message, { top: insets.top + 12 }]}>
          <Alert.Indicator>
            <CircleAlert size={20} color={alertColor} />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Description>{alertMessage}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <SearchSheet
        isHidden={sheetOpen || lineSheetOpen}
        stationsUrl={stationsUrl}
        userLocation={userLocation}
        onSelectStation={selectStation}
        onSelectLine={selectLineFromSearch}
        position={searchSheetPosition}
        getMapFeedbackUrl={getMapFeedbackUrl}
      />

      {selectedStation ? (
        <StationSheet
          station={selectedStation}
          nearbyStations={nearbyStations}
          onSelectNearbyStation={selectNearbyStation}
          isOpen={sheetOpen}
          stationsUrl={stationsUrl}
          userLocation={userLocation}
          onOpenChange={onStationSheetOpenChange}
          onSelectStation={selectStation}
          onSelectLine={selectLineFromStation}
          position={stationSheetPosition}
        />
      ) : null}

      {selectedLine ? (
        <LineSheet
          line={selectedLine.line}
          fromStationId={selectedLine.fromStation?.id ?? null}
          branch={selectedLine.branch}
          onBranchChange={changeLineBranch}
          isOpen={lineSheetOpen}
          stationsUrl={stationsUrl}
          onOpenChange={onLineSheetOpenChange}
          onSelectStation={selectStopFromLine}
          position={lineSheetPosition}
        />
      ) : null}

      {isMapStyleOpen ? (
        <MapStyleSheet
          position={mapStyleSheetPosition}
          onClose={() => setIsMapStyleOpen(false)}
          getMapFeedbackUrl={getMapFeedbackUrl}
        />
      ) : null}

      <IntroSheet intro={intro} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  map: { flex: 1 },
  message: {
    position: "absolute",
    left: 16,
    right: 68,
  },
  missingToken: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  missingTokenCard: { width: "100%" },
});
