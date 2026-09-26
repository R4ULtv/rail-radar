import type { Station } from "@repo/data/types";
import Mapbox from "@rnmapbox/maps";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { Alert } from "heroui-native/alert";
import { Card } from "heroui-native/card";
import { useThemeColor } from "heroui-native/hooks";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Compass,
  LocateButton,
  SheetControls,
  useMapHeading,
  useSheetPosition,
  type LocationStatus,
} from "@/components/map-controls";
import { SearchSheet } from "@/components/search-sheet";
import { Settings } from "@/components/settings-sheet";
import { RailwayLines, StationImages, StationLayers } from "@/components/station-markers";
import { StationSheet } from "@/components/station-sheet";
import { UserLocationMarker } from "@/components/user-location-marker";
import { WelcomeSheet } from "@/components/welcome-sheet";
import { useIsOnline } from "@/hooks/use-is-online";
import { useMapTheme } from "@/hooks/use-map-theme";
import { useStationsUrl } from "@/hooks/use-stations-url";
import { addRecentStation } from "@/hooks/use-stored-stations";
import { haptics } from "@/lib/haptics";
import { mapFeedbackUrl, type MapPosition } from "@/lib/links";
import { loadLastUserLocation, saveLastUserLocation, type UserLocation } from "@/lib/user-location";
import { hasSeenWelcome, markWelcomeSeen } from "@/lib/welcome";

const accessToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";
const defaultCamera = { centerCoordinate: [12, 50] as [number, number], zoomLevel: 4 };
// Same zoom levels as the web: 13 when opening on the user, 14 after tapping locate.
const userZoomLevel = 13;
const locateZoomLevel = 14;
const locationMaxAge = 5 * 60 * 1000;
// Mapbox keeps the last camera padding, so moves that should be centered have to clear it.
const noPadding = { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 };

if (accessToken) {
  Mapbox.setAccessToken(accessToken);
}
// Mapbox's telemetry would send the user's location to Mapbox; it stays on the device instead.
// This is also the opt-out Mapbox requires, which its hidden attribution button would offer.
Mapbox.setTelemetryEnabled(false);

/** Location is "off" when services are disabled or permission can no longer be asked for. */
async function readLocationStatus(): Promise<LocationStatus> {
  const [permission, servicesEnabled] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.hasServicesEnabledAsync(),
  ]);
  if (!servicesEnabled || (!permission.granted && !permission.canAskAgain)) return "off";
  return permission.granted ? "located" : "idle";
}

/** A recent fix if there is one (like the web's maximumAge), otherwise a fresh one. */
async function findUserLocation() {
  const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: locationMaxAge });
  const { coords } =
    lastKnown ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  const location = { latitude: coords.latitude, longitude: coords.longitude };
  saveLastUserLocation(location);
  return location;
}

type StationPressEvent = Parameters<
  NonNullable<ComponentProps<typeof Mapbox.ShapeSource>["onPress"]>
>[0];

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const camera = useRef<Mapbox.Camera>(null);
  const stationsUrl = useStationsUrl();
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(() => !hasSeenWelcome());
  const closeWelcome = useCallback(() => {
    markWelcomeSeen();
    setIsWelcomeOpen(false);
  }, []);
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
  // Open on the last known position, then follow the user once they're found.
  const [initialCamera] = useState(() => {
    const lastLocation = loadLastUserLocation();
    return lastLocation
      ? {
          centerCoordinate: [lastLocation.longitude, lastLocation.latitude] as [number, number],
          zoomLevel: userZoomLevel,
        }
      : defaultCamera;
  });
  // Once the user moves the map, finding their location shouldn't move it back.
  const hasMovedMap = useRef(false);
  // Kept without re-rendering, for the "Improve this map" links.
  const mapPosition = useRef<MapPosition>({
    center: initialCamera.centerCoordinate,
    zoom: initialCamera.zoomLevel,
  });
  const getMapFeedbackUrl = useCallback(() => mapFeedbackUrl(mapPosition.current), []);
  // Whether the map is on the user's location, which fills the locate button.
  const [isCentered, setIsCentered] = useState(false);
  // While a sheet is fully open, the strip of map above it stays still.
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isStationExpanded, setIsStationExpanded] = useState(false);
  const isMapLocked = isSearchExpanded || isStationExpanded;
  // Where the sheets are, for the controls that sit above them.
  const searchSheetPosition = useSheetPosition();
  const stationSheetPosition = useSheetPosition();

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

  const selectStation = useCallback((station: Station, zoomLevel?: number) => {
    haptics.tap();
    hasMovedMap.current = true;
    setIsCentered(false);
    setSelectedStation(station);
    // Opened in the same update, so the first station sheet mounts already open.
    setSheetOpen(true);
    if (station.type === "rail") addRecentStation(station);
    if (!station.geo) return;

    // Centered on the whole screen, so opening, resizing and closing the sheet never move it.
    camera.current?.setCamera({
      centerCoordinate: [station.geo.lng, station.geo.lat],
      zoomLevel,
      padding: noPadding,
      animationDuration: 700,
    });
  }, []);

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

  const handleSearchSelect = useCallback(
    (station: Station) => selectStation(station, station.type === "rail" ? 13 : 14),
    [selectStation],
  );

  // Pick up permission and Location Services changes made in Settings.
  useEffect(() => {
    const refresh = () => {
      readLocationStatus()
        .then((status) =>
          setLocationStatus((current) => (current === "locating" ? current : status)),
        )
        .catch(() => {});
    };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      refresh();
      // The user may have moved while the app was in the background.
      Location.getForegroundPermissionsAsync()
        .then((permission) => (permission.granted ? findUserLocation() : null))
        .then((location) => {
          if (location) setUserLocation(location);
        })
        .catch(() => {});
    });
    return () => subscription.remove();
  }, []);

  // Like the web, look for the user on launch and ask for permission if it hasn't been decided.
  // On the first launch that waits for the welcome, so the permission prompt doesn't cover it.
  useEffect(() => {
    if (isWelcomeOpen) return;
    let cancelled = false;

    (async () => {
      if (!(await Location.hasServicesEnabledAsync())) return;
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (!permission.granted || cancelled) return;

      setLocationStatus("locating");
      const location = await findUserLocation();
      if (cancelled) return;
      setUserLocation(location);
      setLocationStatus("located");
      if (hasMovedMap.current) return;
      setIsCentered(true);
      camera.current?.setCamera({
        centerCoordinate: [location.longitude, location.latitude],
        zoomLevel: userZoomLevel,
        padding: noPadding,
        animationDuration: 0,
      });
    })().catch(() => {
      // Location failures should not block the default map load.
      if (!cancelled) setLocationStatus("idle");
    });

    return () => {
      cancelled = true;
    };
  }, [isWelcomeOpen]);

  const locateUser = useCallback(async () => {
    haptics.tap();
    setLocationStatus("locating");
    try {
      if (!(await Location.hasServicesEnabledAsync())) {
        setLocationStatus("off");
        setMessage("Location Services are turned off.");
        haptics.error();
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationStatus(permission.canAskAgain ? "idle" : "off");
        setMessage("Location permission was not granted.");
        haptics.error();
        return;
      }

      const location = await findUserLocation();
      setUserLocation(location);
      hasMovedMap.current = true;
      setLocationStatus("located");
      setIsCentered(true);
      setMessage(null);
      camera.current?.setCamera({
        centerCoordinate: [location.longitude, location.latitude],
        zoomLevel: locateZoomLevel,
        padding: noPadding,
        animationDuration: 700,
      });
    } catch {
      setLocationStatus("idle");
      setMessage("Your location is unavailable right now.");
      haptics.error();
    }
  }, []);

  const resetHeading = useCallback(() => {
    haptics.tap();
    camera.current?.setCamera({ heading: 0, animationDuration: 300 });
  }, []);

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
    message ??
    (mapFailed
      ? isOnline
        ? "The map could not be loaded."
        : "You're offline. The map will load once you're back online."
      : null);

  return (
    <View style={[styles.screen, { backgroundColor }]}>
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
            setIsCentered(false);
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
        <RailwayLines />
        {stationsUrl ? (
          <StationLayers url={stationsUrl} labelColors={labelColors} onPress={handleStationPress} />
        ) : null}
        {locationStatus === "located" ? <UserLocationMarker /> : null}
      </Mapbox.MapView>

      <View style={[styles.settings, { top: insets.top + 12 }]}>
        <Settings locationStatus={locationStatus} getMapFeedbackUrl={getMapFeedbackUrl} />
      </View>

      <SheetControls sheets={[searchSheetPosition, stationSheetPosition]}>
        <Compass heading={heading} onPress={resetHeading} />
        <LocateButton status={locationStatus} isCentered={isCentered} onPress={locateUser} />
      </SheetControls>

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
        onSelectStation={handleSearchSelect}
        onExpandedChange={setIsSearchExpanded}
        position={searchSheetPosition}
        getMapFeedbackUrl={getMapFeedbackUrl}
      />

      {selectedStation ? (
        <StationSheet
          station={selectedStation}
          isOpen={sheetOpen}
          stationsUrl={stationsUrl}
          userLocation={userLocation}
          onOpenChange={setSheetOpen}
          onSelectStation={selectStation}
          onExpandedChange={setIsStationExpanded}
          position={stationSheetPosition}
        />
      ) : null}

      <WelcomeSheet isOpen={isWelcomeOpen} onClose={closeWelcome} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  map: { flex: 1 },
  settings: {
    position: "absolute",
    right: 16,
  },
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
