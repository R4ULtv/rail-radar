import type { Station } from "@repo/data/types";
import BottomSheet, { BottomSheetScrollView, useBottomSheet } from "@gorhom/bottom-sheet";
import { Button } from "heroui-native/button";
import { useBottomSheetAwareHandlers, useThemeColor } from "heroui-native/hooks";
import { ListGroup } from "heroui-native/list-group";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { SearchField } from "heroui-native/search-field";
import { Separator } from "heroui-native/separator";
import Bookmark from "lucide-react-native/icons/bookmark";
import History from "lucide-react-native/icons/rotate-ccw-clock";
import List from "lucide-react-native/icons/list";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import SearchX from "lucide-react-native/icons/search-x";
import TrendingUp from "lucide-react-native/icons/trending-up";
import User from "lucide-react-native/icons/user";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Keyboard,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CountryFlag } from "@/components/country-flag";
import { useStationSearch } from "@/hooks/use-station-search";
import { useRecentStations, useSavedStations } from "@/hooks/use-stored-stations";
import { useTrendingStations, type TrendingStation } from "@/hooks/use-trending-stations";
import { stationIcons } from "@/lib/station-icons";

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

function StationTypeIcon({ type }: { type: Station["type"] }) {
  return <Image source={stationIcons[type]} style={styles.stationIcon} />;
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

function StationSection({
  title,
  icon,
  stations,
  onSelect,
}: {
  title: string;
  icon?: ReactNode;
  stations: (Station | TrendingStation)[];
  onSelect: (station: Station) => void;
}) {
  if (stations.length === 0) return null;

  return (
    <View className="mt-5">
      <View className="mb-2 ml-2 flex-row items-center gap-1.5">
        {icon}
        <Text className="text-sm font-medium text-muted">{title}</Text>
      </View>
      <ListGroup variant="secondary">
        {stations.map((station, index) => (
          <Fragment key={station.id}>
            {index > 0 ? <Separator className="mx-4" /> : null}
            <PressableFeedback
              accessibilityRole="button"
              animation={false}
              onPress={() => onSelect(station)}
            >
              <PressableFeedback.Scale>
                <ListGroup.Item disabled>
                  <ListGroup.ItemPrefix>
                    <StationTypeIcon type={station.type} />
                  </ListGroup.ItemPrefix>
                  <ListGroup.ItemContent>
                    <View className="flex-row items-center gap-2">
                      <ListGroup.ItemTitle numberOfLines={1} className="shrink">
                        {station.name}
                      </ListGroup.ItemTitle>
                      <CountryFlag stationId={station.id} />
                    </View>
                  </ListGroup.ItemContent>
                  {"visits" in station ? (
                    <ListGroup.ItemSuffix>
                      <VisitorCounts station={station} />
                    </ListGroup.ItemSuffix>
                  ) : null}
                </ListGroup.Item>
              </PressableFeedback.Scale>
              <PressableFeedback.Ripple />
            </PressableFeedback>
          </Fragment>
        ))}
      </ListGroup>
    </View>
  );
}

const attributionLinks = [
  { label: "© Mapbox", url: "https://www.mapbox.com/about/maps/" },
  { label: "© OpenStreetMap", url: "http://www.openstreetmap.org/copyright" },
  { label: "Improve this map", url: "https://www.mapbox.com/map-feedback/" },
];

function MapAttribution() {
  return (
    <Text className="mt-8 text-center text-xs text-muted">
      {attributionLinks.map((link, index) => (
        <Fragment key={link.url}>
          {index > 0 ? ", " : null}
          <Text accessibilityRole="link" onPress={() => void Linking.openURL(link.url)}>
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

function SearchSheetContent({ onSelectStation }: { onSelectStation: (station: Station) => void }) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { animatedIndex, snapToIndex } = useBottomSheet();
  // Only the search bar is visible while collapsed; fade the lists in as the sheet opens.
  const listStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [0, 0.4], [0, 1], Extrapolation.CLAMP),
  }));
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();
  const [query, setQuery] = useState("");
  const search = useStationSearch(query);
  const { savedStations } = useSavedStations();
  const recentStations = useRecentStations();
  const trendingStations = useTrendingStations();
  const [mutedColor, foregroundColor, accentColor] = useThemeColor([
    "muted",
    "default-foreground",
    "accent",
  ]);

  const savedIds = new Set(savedStations.map((station) => station.id));
  const unsavedRecentStations = recentStations.filter((station) => !savedIds.has(station.id));
  const noResults = search.hasResult && !search.error && search.stations.length === 0;
  const showDefaultLists = !search.isActive || noResults;
  const hasDefaultLists =
    unsavedRecentStations.length > 0 || savedStations.length > 0 || trendingStations.length > 0;

  function selectStation(station: Station) {
    Keyboard.dismiss();
    onSelectStation(station);
  }

  return (
    <View style={styles.content}>
      <View className="px-4" style={{ paddingTop: searchFieldTopSpacing }}>
        <SearchField value={query} onChange={setQuery}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              variant="secondary"
              // No focus outline: iOS draws it outside the field, where the sheet clips it.
              className="ios:focus:outline-transparent android:focus:border-transparent"
              placeholder="Search stations"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              onFocus={(event) => {
                onFocus(event);
                snapToIndex(expandedIndex);
              }}
              onBlur={onBlur}
            />
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
              <Text className="mt-0.5 text-xs text-danger-soft-foreground">
                Check your connection and try again.
              </Text>
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
              title="Search Results"
              icon={
                search.isLoading ? (
                  <ActivityIndicator size="small" color={accentColor} />
                ) : (
                  <List size={14} color={mutedColor} />
                )
              }
              stations={search.stations}
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
            <EmptyState>
              <ActivityIndicator color={accentColor} />
            </EmptyState>
          )}
          {showDefaultLists ? (
            <>
              <StationSection
                title="Recent Stations"
                icon={<History size={14} color={mutedColor} />}
                stations={unsavedRecentStations}
                onSelect={selectStation}
              />
              <StationSection
                title="Saved Stations"
                icon={<Bookmark size={14} color={mutedColor} />}
                stations={savedStations}
                onSelect={selectStation}
              />
              <StationSection
                title="Popular Stations (7-day trending)"
                icon={<TrendingUp size={14} color={mutedColor} />}
                stations={trendingStations}
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
          <MapAttribution />
        </BottomSheetScrollView>
      </Animated.View>
    </View>
  );
}

interface SearchSheetProps {
  /** Hides the sheet while another sheet (e.g. a station board) is shown. */
  isHidden: boolean;
  onSelectStation: (station: Station) => void;
}

export function SearchSheet({ isHidden, onSelectStation }: SearchSheetProps) {
  const insets = useSafeAreaInsets();
  const collapsedHeight = useSearchSheetCollapsedHeight();
  const sheetRef = useRef<BottomSheet>(null);
  const lastIndex = useRef(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [surfaceColor, mutedColor] = useThemeColor(["surface", "muted"]);

  useEffect(() => {
    if (isHidden) sheetRef.current?.close();
    else sheetRef.current?.snapToIndex(lastIndex.current);
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
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      keyboardBehavior="extend"
      keyboardBlurBehavior="none"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{ backgroundColor: surfaceColor, borderRadius: 24 }}
      handleIndicatorStyle={{ backgroundColor: mutedColor }}
      onChange={(index) => {
        if (index >= 0) lastIndex.current = index;
        setIsExpanded(index === expandedIndex);
        if (index === 0) Keyboard.dismiss();
      }}
    >
      <SearchSheetContent onSelectStation={onSelectStation} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  stationIcon: { width: 24, height: 24 },
  tabularNums: { fontVariant: ["tabular-nums"] },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
});
