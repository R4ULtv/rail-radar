import type { Station } from "@repo/data/types";
import BottomSheet, {
  BottomSheetSectionList,
  useBottomSheet,
  useBottomSheetInternal,
} from "@gorhom/bottom-sheet";
import { useBottomSheetAwareHandlers, useThemeColor } from "heroui-native/hooks";
import { SearchField } from "heroui-native/search-field";
import { ListGroup } from "heroui-native/list-group";
import Bookmark from "lucide-react-native/icons/bookmark";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import History from "lucide-react-native/icons/rotate-ccw-clock";
import List from "lucide-react-native/icons/list";
import SearchX from "lucide-react-native/icons/search-x";
import TrendingUp from "lucide-react-native/icons/trending-up";
import User from "lucide-react-native/icons/user";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from "react";
import {
  BackHandler,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type SectionList,
  type SectionListRenderItemInfo,
} from "react-native";
import {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { MapAttribution } from "@/components/map-attribution";
import { ReorderableStationList } from "@/components/reorderable-station-list";
import {
  useSheetBottomInset,
  useSheetTopInset,
  type SheetPosition,
} from "@/components/map-controls";
import {
  PinnedSheetHeader,
  sheetBackgroundStyle,
  SheetHeaderFade,
  useSheetScrollOffset,
} from "@/components/sheet-header";
import {
  RowSeparator,
  ShowAllButton,
  StationRow,
  StationSectionTitle,
  StationSectionSkeleton,
  type SectionIcon,
} from "@/components/station-list";
import { StatusMessage } from "@/components/status-message";
import { useStationSearch } from "@/hooks/use-station-search";
import { moveSavedStation, useRecentStations, useSavedStations } from "@/hooks/use-stored-stations";
import { useTrendingStations, type TrendingStation } from "@/hooks/use-trending-stations";
import { distanceKm, formatDistance } from "@/lib/distance";
import { formatCount } from "@/lib/format";
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
    // Only the unique visitors, which the ranking and the station's popularity use. The station
    // sheet has both counts, spelled out.
    <View
      accessible
      accessibilityLabel={`${formatCount(station.uniqueVisitors)} unique visitors, ${formatCount(station.visits)} visits`}
      className="flex-row items-center gap-1"
    >
      <User size={14} color={color} />
      <Text className="text-sm text-muted" style={styles.tabularNums}>
        {formatCount(station.uniqueVisitors)}
      </Text>
    </View>
  );
}

function renderVisitorCounts(station: TrendingStation) {
  return <VisitorCounts station={station} />;
}

// Only used by the trending section, whose rows include these counts.
function renderTrendingSuffix(station: Station) {
  return renderVisitorCounts(station as TrendingStation);
}

function StationDistance({ station, from }: { station: Station; from: UserLocation }) {
  if (!station.geo) return null;
  return (
    <Text className="text-sm text-muted" style={styles.tabularNums}>
      {formatDistance(distanceKm(from, station.geo))}
    </Text>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <View style={styles.emptyState}>{children}</View>;
}

const searchResultsTitle = "Search results";
const trendingTitle = "Trending (last 7 days)";

/** The saved stations are a single item, so a row can be dragged to another place among them. */
interface SavedStationsItem {
  savedStations: Station[];
}

type SearchItem = Station | SavedStationsItem;

interface SearchSection {
  key: "results" | "recent" | "saved" | "trending";
  title: string;
  icon: SectionIcon;
  data: SearchItem[];
  renderSuffix?: (station: Station) => ReactNode;
  fullCount?: number;
  isExpanded?: boolean;
}

function itemKey(item: SearchItem) {
  return "savedStations" in item ? "saved" : item.id;
}

// Memoized, so hiding and showing the sheet around a station sheet doesn't re-render its lists.
const SearchSheetContent = memo(function SearchSheetContent({
  stationsUrl,
  userLocation,
  isVisible,
  trendingStations,
  isTrendingLoading,
  onSelectStation,
  getMapFeedbackUrl,
}: {
  stationsUrl: string | null;
  userLocation: UserLocation | null;
  isVisible: boolean;
  trendingStations: TrendingStation[];
  /** The first trending list is still loading. */
  isTrendingLoading: boolean;
  onSelectStation: (station: Station) => void;
  getMapFeedbackUrl: () => string;
}) {
  const bottomInset = useSheetBottomInset();
  const keyboardHeight = useKeyboardHeight();
  // As tall as the open sheet instead of filling it. The sheet sets its height in an animation,
  // and on Android the list didn't always shrink to it, so it ran below the screen and barely
  // scrolled. The sheet clips it, and still opens only as tall as the lists. Measured from the
  // sheet's container, which starts at the top inset, since Android's window height can leave out
  // the navigation bar.
  const topInset = useSheetTopInset();
  const { height: windowHeight } = useWindowDimensions();
  const [containerHeight, setContainerHeight] = useState(windowHeight - topInset);
  const { animatedLayoutState } = useBottomSheetInternal();
  useAnimatedReaction(
    () => animatedLayoutState.get().containerHeight,
    (height, previous) => {
      if (height > 0 && height !== previous) scheduleOnRN(setContainerHeight, height);
    },
  );
  const contentHeight = containerHeight - handleHeight;
  const { animatedIndex, snapToIndex } = useBottomSheet();
  // Only the search bar is visible while collapsed; fade the lists in as the sheet opens.
  const listStyle = useAnimatedStyle(() => ({
    opacity: interpolate(animatedIndex.value, [0, 0.4], [0, 1], Extrapolation.CLAMP),
  }));
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();
  const inputRef = useRef<ComponentRef<typeof SearchField.Input>>(null);
  const [scrollRef, scrollOffset] = useSheetScrollOffset<SectionList<SearchItem, SearchSection>>();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  // The list doesn't scroll under a saved station that's being dragged.
  const [isReordering, setIsReordering] = useState(false);

  // Android's back button hides the keyboard but leaves the field focused.
  useEffect(() => {
    if (keyboardHeight === 0) inputRef.current?.blur();
  }, [keyboardHeight]);
  const [query, setQuery] = useState("");
  // Focusing the field starts building the search index, before the first character is typed.
  const { savedStations } = useSavedStations();
  const recentStations = useRecentStations();
  const search = useStationSearch(query, {
    stationsUrl,
    userLocation,
    visible: isVisible,
    preload: isFocused,
    savedStations,
    recentStations,
  });
  const mutedColor = useThemeColor("muted");

  // The lists are memoized, so they only render again when these change.
  const unsavedRecentStations = useMemo(() => {
    const savedIds = new Set(savedStations.map((station) => station.id));
    return recentStations.filter((station) => !savedIds.has(station.id));
  }, [recentStations, savedStations]);
  const renderDistance = useMemo(() => {
    const from = search.location;
    return from
      ? (station: Station) => <StationDistance station={station} from={from} />
      : undefined;
  }, [search.location]);
  const noResults = search.hasResult && !search.error && search.stations.length === 0;
  const showDefaultLists = !search.isActive || noResults;
  const hasDefaultLists =
    unsavedRecentStations.length > 0 ||
    savedStations.length > 0 ||
    trendingStations.length > 0 ||
    isTrendingLoading;
  const [sectionDisplay, setSectionDisplay] = useState({
    defaultsVisible: showDefaultLists,
    recentExpanded: false,
    savedExpanded: false,
  });
  // Previously these sections unmounted during a search. Keep that collapse behavior,
  // while the outer scrollable itself stays mounted.
  if (sectionDisplay.defaultsVisible !== showDefaultLists) {
    setSectionDisplay({
      defaultsVisible: showDefaultLists,
      recentExpanded: false,
      savedExpanded: false,
    });
  }
  const recentExpanded =
    sectionDisplay.defaultsVisible === showDefaultLists && sectionDisplay.recentExpanded;
  const savedExpanded =
    sectionDisplay.defaultsVisible === showDefaultLists && sectionDisplay.savedExpanded;
  // Kept stable while the sections change around it, so a drag in progress isn't reset.
  const savedItem = useMemo<SavedStationsItem>(
    () => ({ savedStations: savedExpanded ? savedStations : savedStations.slice(0, 5) }),
    [savedStations, savedExpanded],
  );

  const selectStation = useCallback(
    (station: Station) => {
      Keyboard.dismiss();
      onSelectStation(station);
    },
    [onSelectStation],
  );

  const sections = useMemo<SearchSection[]>(() => {
    const result: SearchSection[] = [];
    if (search.isActive && !search.error && search.stations.length > 0) {
      result.push({
        key: "results",
        title: searchResultsTitle,
        icon: List,
        data: search.stations,
        renderSuffix: renderDistance,
      });
    }
    if (showDefaultLists) {
      if (unsavedRecentStations.length > 0) {
        result.push({
          key: "recent",
          title: "Recent stations",
          icon: History,
          data: recentExpanded ? unsavedRecentStations : unsavedRecentStations.slice(0, 3),
          fullCount: unsavedRecentStations.length,
          isExpanded: recentExpanded,
          renderSuffix: renderDistance,
        });
      }
      if (savedStations.length > 0) {
        result.push({
          key: "saved",
          title: "Saved stations",
          icon: Bookmark,
          data: [savedItem],
          fullCount: savedStations.length,
          isExpanded: savedExpanded,
        });
      }
      if (!isTrendingLoading && trendingStations.length > 0) {
        result.push({
          key: "trending",
          title: trendingTitle,
          icon: TrendingUp,
          data: trendingStations,
          renderSuffix: renderTrendingSuffix,
        });
      }
    }
    return result;
  }, [
    search.isActive,
    search.error,
    search.stations,
    renderDistance,
    showDefaultLists,
    unsavedRecentStations,
    savedStations,
    recentExpanded,
    savedExpanded,
    savedItem,
    isTrendingLoading,
    trendingStations,
  ]);

  const renderStation = useCallback(
    ({ item, index, section }: SectionListRenderItemInfo<SearchItem, SearchSection>) =>
      "savedStations" in item ? (
        <ReorderableStationList
          stations={item.savedStations}
          renderSuffix={renderDistance}
          onSelect={selectStation}
          onMove={moveSavedStation}
          onDragActiveChange={setIsReordering}
        />
      ) : (
        // Each cell supplies its own surface, with corners only at the section's ends. The
        // section itself never wraps all of its rows in a single, eagerly mounted view.
        <ListGroup
          variant="secondary"
          className={`overflow-hidden rounded-none shadow-none ${index === 0 ? "rounded-t-3xl" : ""} ${index === section.data.length - 1 ? "rounded-b-3xl" : ""}`}
        >
          {index > 0 ? <RowSeparator /> : null}
          <StationRow station={item} renderSuffix={section.renderSuffix} onSelect={selectStation} />
        </ListGroup>
      ),
    [selectStation, renderDistance],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SearchSection }) => (
      <View className="mt-5">
        <StationSectionTitle icon={section.icon} title={section.title} />
      </View>
    ),
    [],
  );

  const renderSectionFooter = useCallback(({ section }: { section: SearchSection }) => {
    const collapsedCount = section.key === "recent" ? 3 : 5;
    if (section.fullCount === undefined || section.fullCount <= collapsedCount) return null;
    return (
      <ShowAllButton
        count={section.fullCount}
        isExpanded={section.isExpanded ?? false}
        onPress={() => {
          setSectionDisplay((current) =>
            section.key === "recent"
              ? { ...current, recentExpanded: !current.recentExpanded }
              : { ...current, savedExpanded: !current.savedExpanded },
          );
        }}
      />
    );
  }, []);

  return (
    <View style={{ height: contentHeight }}>
      <PinnedSheetHeader onHeightChange={setHeaderHeight}>
        {/* The padding is in here, since the fade below hangs from where it ends. */}
        <View className="px-4" style={styles.searchHeader}>
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
        {/* Its gap is part of the lists' top margin. */}
        <SheetHeaderFade scrollOffset={scrollOffset} />
      </PinnedSheetHeader>

      <BottomSheetSectionList
        ref={scrollRef}
        sections={sections}
        keyExtractor={itemKey}
        renderItem={renderStation}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={renderSectionFooter}
        stickySectionHeadersEnabled={false}
        initialNumToRender={12}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={false}
        scrollEnabled={!isReordering}
        style={listStyle}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: headerHeight,
          paddingHorizontal: 16,
          // With the keyboard up, the same space above it instead.
          paddingBottom: Math.max(keyboardHeight + 16, bottomInset),
        }}
        scrollIndicatorInsets={{ top: headerHeight }}
        ListHeaderComponent={
          <View>
            {!search.isActive ? null : search.error ? (
              <StatusMessage
                className="mt-5"
                icon={CircleAlert}
                title="Unable to search stations"
                description={search.error}
                onRetry={search.retry}
              />
            ) : search.stations.length > 0 ? null : noResults ? (
              <StatusMessage
                className="mt-5"
                icon={SearchX}
                title="No stations found"
                description="Try a different search term."
              />
            ) : (
              <StationSectionSkeleton title={searchResultsTitle} icon={List} />
            )}
          </View>
        }
        ListFooterComponent={
          <View>
            {showDefaultLists && isTrendingLoading ? (
              <StationSectionSkeleton title={trendingTitle} icon={TrendingUp} hasSuffix />
            ) : null}
            {showDefaultLists && !search.isActive && !hasDefaultLists ? (
              <EmptyState>
                <Text className="text-center text-sm text-muted">
                  Search for a station by name, or save one from its live board to find it here.
                </Text>
              </EmptyState>
            ) : null}
            <MapAttribution className="mt-8" getMapFeedbackUrl={getMapFeedbackUrl} />
          </View>
        }
      />
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
  position,
  getMapFeedbackUrl,
}: SearchSheetProps) {
  const topInset = useSheetTopInset();
  const collapsedHeight = useSearchSheetCollapsedHeight();
  const sheetRef = useRef<BottomSheet>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [surfaceColor, mutedColor] = useThemeColor(["surface", "muted"]);
  // The list only shows while the sheet is open, so it isn't refreshed while collapsed or hidden.
  const trending = useTrendingStations(isExpanded && !isHidden);

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
      // Collapsed to the search bar, or open as tall as the lists, up to the top of the screen.
      snapPoints={[collapsedHeight]}
      topInset={topInset}
      animatedIndex={position.animatedIndex}
      animatedPosition={position.animatedPosition}
      enablePanDownToClose={false}
      keyboardBehavior="extend"
      keyboardBlurBehavior="none"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={[sheetBackgroundStyle, { backgroundColor: surfaceColor }]}
      handleIndicatorStyle={{ backgroundColor: mutedColor }}
      onChange={(index) => {
        setIsExpanded(index === expandedIndex);
        if (index === 0) Keyboard.dismiss();
      }}
    >
      <SearchSheetContent
        stationsUrl={stationsUrl}
        userLocation={userLocation}
        isVisible={isExpanded && !isHidden}
        trendingStations={trending.stations}
        isTrendingLoading={trending.isLoading}
        onSelectStation={onSelectStation}
        getMapFeedbackUrl={getMapFeedbackUrl}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  searchHeader: { paddingTop: searchFieldTopSpacing },
  tabularNums: { fontVariant: ["tabular-nums"] },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
});
