import type { Station } from "@repo/data/types";
import Mapbox from "@rnmapbox/maps";
import { StatusBar } from "expo-status-bar";
import { Alert } from "heroui-native/alert";
import { Card } from "heroui-native/card";
import { useThemeColor } from "heroui-native/hooks";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
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
import { MapStyleSheet } from "@/components/map-style-sheet";
import { SearchSheet } from "@/components/search-sheet";
import { Settings } from "@/components/settings-sheet";
import { RailwayLines, StationImages, StationLayers } from "@/components/station-markers";
import { middleStep, StationSheet } from "@/components/station-sheet";
import { StatusBarBlur } from "@/components/status-bar-blur";
import { UserLocationMarker } from "@/components/user-location-marker";
import { useIsOnline } from "@/hooks/use-is-online";
import { useMapTheme } from "@/hooks/use-map-theme";
import { useStationLinks } from "@/hooks/use-station-links";
import { useStationsUrl } from "@/hooks/use-stations-url";
import { addRecentStation } from "@/hooks/use-stored-stations";
import { useUserLocation } from "@/hooks/use-user-location";
import { haptics } from "@/lib/haptics";
import { mapFeedbackUrl, type MapPosition } from "@/lib/links";
import type { LocationFix } from "@/lib/location-tracking";
import { hasUsedNearbyButton, markNearbyButtonUsed } from "@/lib/nearby-button";
import { findNearbyDepartures } from "@/lib/nearby-departures";
import { loadStationSearch, loadStations, type NearbyStation } from "@/lib/stations";
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

type StationPressEvent = Parameters<
  NonNullable<ComponentProps<typeof Mapbox.ShapeSource>["onPress"]>
>[0];

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const sheetTopInset = useSheetTopInset();
  // The map's own height, since Android's window height can leave out the navigation bar.
  const mapHeight = useRef(0);
  const reduceMotion = useReducedMotion();
  const camera = useRef<Mapbox.Camera>(null);
  const stationsUrl = useStationsUrl();
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The closest train stations, while the station sheet was opened from the nearby button.
  const [nearbyStations, setNearbyStations] = useState<NearbyStation[]>([]);
  const [isFindingNearby, setIsFindingNearby] = useState(false);
  const findingNearby = useRef(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [hasUsedNearby, setHasUsedNearby] = useState(hasUsedNearbyButton);
  const intro = useIntro();
  const isIntroOpen = intro.page !== null;
  const {
    location: userLocation,
    status: locationStatus,
    message,
    locate,
  } = useUserLocation(!isIntroOpen);
  const isOnline = useIsOnline();
  const [mapFailed, setMapFailed] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const wasOnline = useRef(isOnline);
  const hasLoadedMap = useRef(false);
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
  const following = useRef(false);
  // Where the sheets are, for the controls that sit above them.
  const searchSheetPosition = useSheetPosition();
  const stationSheetPosition = useSheetPosition();
  // While a sheet is fully open, the strip of map above it stays still.
  const isMapLocked = useIsSheetFullyOpen([searchSheetPosition, stationSheetPosition]);
  const mapStyleSheetPosition = useSheetPosition();
  const [isMapStyleOpen, setIsMapStyleOpen] = useState(false);

  // A map that failed to load, e.g. on a first launch without a connection, is loaded again
  // once the connection comes back. Mapbox keeps what it loaded, so later launches work offline.
  useEffect(() => {
    const isBackOnline = isOnline && !wasOnline.current;
    wasOnline.current = isOnline;
    if (isBackOnline && mapFailed) {
      setMapFailed(false);
      setMapKey((key) => key + 1);
    }
  }, [isOnline, mapFailed]);

  const stopFollowing = useCallback(() => {
    cameraAction.current++;
    following.current = false;
    setIsFollowing(false);
  }, []);

  const onStationSheetOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) stopFollowing();
      else setNearbyStations([]);
      setSheetOpen(isOpen);
    },
    [stopFollowing],
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
      // Let the camera move start before updating the search sheet's recent list.
      setTimeout(() => addRecentStation(station), 0);
      if (!station.geo) return;

      // Above the station sheet's middle step, and so above its peek too. The padding stays the
      // same as the sheet changes size, so the map doesn't move with it.
      const height = mapHeight.current;
      const sheetTop = sheetTopInset + (height - sheetTopInset) * (1 - middleStep);
      const stationY = sheetTop - stationSheetClearance;
      camera.current?.setCamera({
        centerCoordinate: [station.geo.lng, station.geo.lat],
        zoomLevel: stationZoomLevels[station.type],
        padding: { ...noPadding, paddingBottom: Math.max(height - 2 * stationY, 0) },
        animationMode: "easeTo",
        animationDuration: reduceMotion ? 0 : 700,
      });
    },
    [stopFollowing, sheetTopInset, reduceMotion],
  );

  const openNearbyDepartures = useCallback(async () => {
    if (!stationsUrl || findingNearby.current) return;
    findingNearby.current = true;
    setIsFindingNearby(true);
    setNearbyError(null);
    haptics.tap();
    hasMovedMap.current = true;
    stopFollowing();
    const action = cameraAction.current;
    try {
      const [location, stations] = await Promise.all([locate(), loadStations(stationsUrl)]);
      // Panning, locating, or choosing a station while GPS loads takes precedence.
      if (action !== cameraAction.current) return;
      // Locating already explains why there's no location, e.g. that it's turned off.
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
        markNearbyButtonUsed();
        setHasUsedNearby(true);
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
  }, [stationsUrl, locate, stopFollowing, selectStation, hasUsedNearby]);

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

  // A shared station link opens the station like a search result.
  useStationLinks(stationsUrl, selectStation);

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
          if (!hasLoadedMap.current) setMapFailed(true);
        }}
        onDidFinishLoadingStyle={() => setLabelColors(mapTheme)}
        onDidFinishLoadingMap={() => {
          hasLoadedMap.current = true;
          setMapFailed(false);
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
          </>
        ) : null}
        {userLocation ? <UserLocationMarker location={userLocation} /> : null}
      </Mapbox.MapView>

      <StatusBarBlur />

      <TopControls
        sheets={[searchSheetPosition, stationSheetPosition, mapStyleSheetPosition]}
        top={insets.top + 12}
      >
        <Settings locationStatus={locationStatus} getMapFeedbackUrl={getMapFeedbackUrl} />
      </TopControls>

      <SheetControls
        sheets={[searchSheetPosition, stationSheetPosition]}
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
          sheets={[searchSheetPosition, stationSheetPosition]}
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
        isHidden={sheetOpen}
        stationsUrl={stationsUrl}
        userLocation={userLocation}
        onSelectStation={selectStation}
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
          position={stationSheetPosition}
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
