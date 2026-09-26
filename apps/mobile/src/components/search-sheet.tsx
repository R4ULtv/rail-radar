import type { Station } from "@repo/data/types";
import BottomSheet, { BottomSheetScrollView, useBottomSheet } from "@gorhom/bottom-sheet";
import { Button } from "heroui-native/button";
import { useBottomSheetAwareHandlers, useThemeColor } from "heroui-native/hooks";
import { SearchField } from "heroui-native/search-field";
import Bookmark from "lucide-react-native/icons/bookmark";
import History from "lucide-react-native/icons/rotate-ccw-clock";
import List from "lucide-react-native/icons/list";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import SearchX from "lucide-react-native/icons/search-x";
import TrendingUp from "lucide-react-native/icons/trending-up";
import User from "lucide-react-native/icons/user";
import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from "react";
import { BackHandler, Keyboard, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { SheetPosition } from "@/components/map-controls";
import { StationSection, StationSectionSkeleton } from "@/components/station-list";
import { useStationSearch } from "@/hooks/use-station-search";
import { useRecentStations, useSavedStations } from "@/hooks/use-stored-stations";
import { useTrendingStations, type TrendingStation } from "@/hooks/use-trending-stations";
import { distanceKm, formatDistance } from "@/lib/distance";
import { mapboxUrl, openStreetMapUrl } from "@/lib/links";
import type { UserLocation } from "@/lib/user-location";

const handleHeight = 24;
const searchFieldHeight = 48;
// Breathing room between the drag handle and the search bar.
const searchFieldTopSpacing = 6;
const expandedIndex = 1;

/** Height of the sheet when it only shows the search bar. */
function useSearchSheetCollapsedHeight() {
  const insets = useSafeAreaInsets();
  return handleHeight + searchFieldTopSpacing + searchFieldHeight + Math.max(insets.bottom, 16);
}

function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) =>
      setHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

function VisitorCounts({ station }: { station: TrendingStation }) {
  const color = useThemeColor("muted");
  return (
    <View className="flex-row items-center gap-1">
      <User size={14} color={color} />
      <Text className="text-xs text-muted" style={styles.tabularNums}>
        {station.uniqueVisitors.toLocaleString()} ({station.visits.toLocaleString()})
      </Text>
    </View>
  );
}

function renderVisitorCounts(station: TrendingStation) {
  return <VisitorCounts station={station} />;
}

function StationDistance({ station, from }: { station: Station; from: UserLocation }) {
  if (!station.geo) return null;
  return (
    <Text className="text-xs text-muted" style={styles.tabularNums}>
      {formatDistance(distanceKm(from, station.geo))}
    </Text>
  );
}

function MapAttribution({ getMapFeedbackUrl }: { getMapFeedbackUrl: () => string }) {
  const links = [
    { label: "© Mapbox", url: () => mapboxUrl },
    { label: "© OpenStreetMap", url: () => openStreetMapUrl },
    { label: "Improve this map", url: getMapFeedbackUrl },
  ];

  return (
    <Text className="mt-8 text-center text-xs text-muted">
      {links.map((link, index) => (
        <Fragment key={link.label}>
          {index > 0 ? ", " : null}
          <Text accessibilityRole="link" onPress={() => void Linking.openURL(link.url())}>
            {link.label}
          </Text>
        </Fragment>
      ))}
    </Text>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <View style={styles.emptyState}>{children}</View>;
}

const searchResultsTitle = "Search Results";

// Memoized, so hiding and showing the sheet around a station sheet doesn't re-render its lists.
const SearchSheetContent = memo(function SearchSheetContent({
  stationsUrl,
  userLocation,
  trendingStations,
  onSelectStation,
  getMapFeedbackUrl,
}: {
  stationsUrl: string | null;
  userLocation: UserLocation | null;
  trendingStations: TrendingStation[];
  onSelectStation: (station: Station) => void;
  getMapFeedbackUrl: () => string;
}) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { animatedIndex, snapToIndex } = useBottomSheet();
  // Only the search bar is visible while collapsed; fade the lists in as the sheet opens.
  const listStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [0, 0.4], [0, 1], Extrapolation.CLAMP),
  }));
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();
  const inputRef = useRef<ComponentRef<typeof SearchField.Input>>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Android's back button hides the keyboard but leaves the field focused.
  useEffect(() => {
    if (keyboardHeight === 0) inputRef.current?.blur();
  }, [keyboardHeight]);
  const [query, setQuery] = useState("");
  // Focusing the field starts building the search index, before the first character is typed.
  const search = useStationSearch(query, { stationsUrl, userLocation, preload: isFocused });
  const { savedStations } = useSavedStations();
  const recentStations = useRecentStations();
  const [mutedColor, foregroundColor] = useThemeColor(["muted", "default-foreground"]);

  // The lists are memoized, so they only render again when these change.
  const unsavedRecentStations = useMemo(() => {
    const savedIds = new Set(savedStations.map((station) => station.id));
    return recentStations.filter((station) => !savedIds.has(station.id));
  }, [recentStations, savedStations]);
  const renderDistance = useMemo(
    () =>
      userLocation
        ? (station: Station) => <StationDistance station={station} from={userLocation} />
        : undefined,
    [userLocation],
  );
  const noResults = search.hasResult && !search.error && search.stations.length === 0;
  const showDefaultLists = !search.isActive || noResults;
  const hasDefaultLists =
    unsavedRecentStations.length > 0 || savedStations.length > 0 || trendingStations.length > 0;

  const selectStation = useCallback(
    (station: Station) => {
      Keyboard.dismiss();
      onSelectStation(station);
    },
    [onSelectStation],
  );

  return (
    <View style={styles.content}>
      <View className="px-4" style={{ paddingTop: searchFieldTopSpacing }}>
        <SearchField value={query} onChange={setQuery}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              ref={inputRef}
              variant="secondary"
              // No focus outline: iOS draws it outside the field, where the sheet clips it.
              className="ios:focus:outline-transparent android:focus:border-transparent"
              placeholder="Search stations"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              onFocus={(event) => {
                onFocus(event);
                setIsFocused(true);
                snapToIndex(expandedIndex);
              }}
              onBlur={(event) => {
                onBlur(event);
                setIsFocused(false);
              }}
            />
            {isFocused ? null : (
              // Android text fields keep any touch that starts on them, so a drag from the
              // field never reached the sheet. Until it's focused, taps go through this cover.
              <Pressable
                accessible={false}
                importantForAccessibility="no"
                style={StyleSheet.absoluteFill}
                onPress={() => inputRef.current?.focus()}
              />
            )}
            <SearchField.ClearButton />
            {query.length === 0 && savedStations.length > 0 ? (
              // Same spot as the clear button, which only shows once there's a query.
              <View
                pointerEvents="none"
                accessibilityLabel={`${savedStations.length} saved stations`}
                className="absolute end-3 flex-row items-center gap-1"
              >
                <Text className="text-xs text-muted" style={styles.tabularNums}>
                  {savedStations.length}
                </Text>
                <Bookmark size={14} color={mutedColor} />
              </View>
            ) : null}
          </SearchField.Group>
        </SearchField>
      </View>

      <Animated.View style={[styles.content, listStyle]}>
        <BottomSheetScrollView
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: Math.max(keyboardHeight, insets.bottom) + 24,
          }}
        >
          {!search.isActive ? null : search.error ? (
            <View className="mt-5 rounded-2xl bg-danger-soft p-4">
              <Text className="text-sm font-medium text-danger-soft-foreground">
                Unable to search stations
              </Text>
              <Text className="mt-0.5 text-xs text-danger-soft-foreground">{search.error}</Text>
              <Button
                className="mt-3 self-start"
                size="sm"
                variant="secondary"
                onPress={search.retry}
              >
                <RefreshCw size={15} color={foregroundColor} />
                <Button.Label>Try again</Button.Label>
              </Button>
            </View>
          ) : search.stations.length > 0 ? (
            <StationSection
              title={searchResultsTitle}
              icon={List}
              stations={search.stations}
              renderSuffix={renderDistance}
              onSelect={selectStation}
            />
          ) : noResults ? (
            <View className="mt-5 flex-row items-center gap-3 px-2">
              <SearchX size={20} color={mutedColor} />
              <View className="gap-0.5">
                <Text className="text-sm font-medium text-foreground">No stations found</Text>
                <Text className="text-xs text-muted">Try a different search term</Text>
              </View>
            </View>
          ) : (
            <StationSectionSkeleton title={searchResultsTitle} icon={List} />
          )}
          {showDefaultLists ? (
            <>
              <StationSection
                title="Recent Stations"
                icon={History}
                stations={unsavedRecentStations}
                onSelect={selectStation}
              />
              <StationSection
                title="Saved Stations"
                icon={Bookmark}
                stations={savedStations}
                onSelect={selectStation}
              />
              <StationSection
                title="Popular Stations (7-day trending)"
                icon={TrendingUp}
                stations={trendingStations}
                renderSuffix={renderVisitorCounts}
                onSelect={selectStation}
              />
              {!search.isActive && !hasDefaultLists ? (
                <EmptyState>
                  <Text className="text-center text-sm text-muted">
                    Search for a station by name, or save one from its live board to find it here.
                  </Text>
                </EmptyState>
              ) : null}
            </>
          ) : null}
          <MapAttribution getMapFeedbackUrl={getMapFeedbackUrl} />
        </BottomSheetScrollView>
      </Animated.View>
    </View>
  );
});

interface SearchSheetProps {
  /** Hides the sheet while another sheet (e.g. a station board) is shown. */
  isHidden: boolean;
  /** The station GeoJSON the map shows, which search runs on. */
  stationsUrl: string | null;
  /** Where the user is: nearby stations rank higher and results show their distance. */
  userLocation: UserLocation | null;
  onSelectStation: (station: Station) => void;
  /** Whether the sheet is fully open, so the map can ignore gestures in the strip above it. */
  onExpandedChange: (isExpanded: boolean) => void;
  /** Where the sheet is, for the map controls that sit above it. */
  position: SheetPosition;
  /** "Improve this map" for where the map is now, for the map credits. */
  getMapFeedbackUrl: () => string;
}

export function SearchSheet({
  isHidden,
  stationsUrl,
  userLocation,
  onSelectStation,
  onExpandedChange,
  position,
  getMapFeedbackUrl,
}: SearchSheetProps) {
  const insets = useSafeAreaInsets();
  const collapsedHeight = useSearchSheetCollapsedHeight();
  const sheetRef = useRef<BottomSheet>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [surfaceColor, mutedColor] = useThemeColor(["surface", "muted"]);
  // The list only shows while the sheet is open, so it isn't refreshed while collapsed or hidden.
  const trendingStations = useTrendingStations(isExpanded && !isHidden);

  // Back from a station, the sheet comes back collapsed. Its content stays mounted while hidden,
  // so the query and results are still there when it's opened again.
  useEffect(() => {
    if (isHidden) sheetRef.current?.close();
    else sheetRef.current?.snapToIndex(0);
  }, [isHidden]);

  // Android back collapses the open sheet instead of leaving the app.
  useEffect(() => {
    if (!isExpanded || isHidden) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      sheetRef.current?.snapToIndex(0);
      return true;
    });
    return () => subscription.remove();
  }, [isExpanded, isHidden]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      // Collapsed to the search bar or fully open; the half step is for the station sheet.
      snapPoints={[collapsedHeight, "100%"]}
      topInset={insets.top + 8}
      animatedIndex={position.animatedIndex}
      animatedPosition={position.animatedPosition}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      keyboardBehavior="extend"
      keyboardBlurBehavior="none"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{ backgroundColor: surfaceColor, borderRadius: 24 }}
      handleIndicatorStyle={{ backgroundColor: mutedColor }}
      onChange={(index) => {
        setIsExpanded(index === expandedIndex);
        onExpandedChange(index === expandedIndex);
        if (index === 0) Keyboard.dismiss();
      }}
    >
      <SearchSheetContent
        stationsUrl={stationsUrl}
        userLocation={userLocation}
        trendingStations={trendingStations}
        onSelectStation={onSelectStation}
        getMapFeedbackUrl={getMapFeedbackUrl}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  tabularNums: { fontVariant: ["tabular-nums"] },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
});
