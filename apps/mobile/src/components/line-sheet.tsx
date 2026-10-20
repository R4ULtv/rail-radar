import { getStationLines } from "@repo/data/lines";
import type { Station } from "@repo/data/types";
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetView,
  useBottomSheet,
  type BottomSheetFlatListMethods,
} from "@gorhom/bottom-sheet";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { Surface } from "heroui-native/surface";
import Bookmark from "lucide-react-native/icons/bookmark";
import ChevronsUpDown from "lucide-react-native/icons/chevrons-up-down";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Info from "lucide-react-native/icons/info";
import Share from "lucide-react-native/icons/share";
import Share2 from "lucide-react-native/icons/share-2";
import Split from "lucide-react-native/icons/split";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type Ref } from "react";
import {
  BackHandler,
  Image,
  Platform,
  Pressable,
  Share as NativeShare,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type FlatList,
  type ListRenderItemInfo,
} from "react-native";
// Gesture handler's, so it settles horizontal drags with the sheet's own pan gesture on Android.
import { ScrollView } from "react-native-gesture-handler";

import { CountryFlag } from "@/components/country-flag";
import { ErrorBoundary } from "@/components/error-boundary";
import { LineBadge } from "@/components/line-badge";
import {
  useSheetBottomInset,
  useSheetTopInset,
  type SheetPosition,
} from "@/components/map-controls";
import {
  PinnedSheetHeader,
  sheetBackgroundStyle,
  SheetHeader,
  SheetHeaderFade,
  useSheetScrollOffset,
} from "@/components/sheet-header";
import { Skeleton } from "@/components/skeleton";
import { SectionTitle } from "@/components/station-list";
import { middleStep } from "@/components/station-sheet";
import { StatusMessage } from "@/components/status-message";
import { useSavedLines } from "@/hooks/use-saved-lines";
import { useStationsById } from "@/hooks/use-stations-by-id";
import { haptics } from "@/lib/haptics";
import {
  collapseStops,
  getBranchLabel,
  getLineColor,
  getLineCountry,
  getLineOperatorName,
  getLineStopCount,
  getRouteStops,
  lineTypeLabels,
  shortStationName,
  type Line,
} from "@/lib/lines";
import { lineUrl } from "@/lib/links";
import { stationIcons } from "@/lib/station-icons";

const handleHeight = 24;
// How much further the content has to go for the middle step to be worth a stop.
const minStepGap = 80;
// Between the pinned header and the first stop.
const stopsTopSpacing = 8;
const skeletonStopCount = 6;
// A stop row at the default text size, and how many show above a stop the list scrolls to.
const stopRowHeight = 44;
const stopsAboveFocus = 2;

function LineSubtitle({ line }: { line: Line }) {
  const stopCount = getLineStopCount(line);
  const subtitle = [
    lineTypeLabels[line.type],
    getLineOperatorName(line),
    `${stopCount} ${stopCount === 1 ? "stop" : "stops"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className="mt-1 flex-row items-center gap-1.5">
      <CountryFlag country={getLineCountry(line)} />
      <Text className="shrink text-sm text-muted" numberOfLines={1}>
        {subtitle}
      </Text>
    </View>
  );
}

const QuickActions = memo(function QuickActions({ line }: { line: Line }) {
  const [foregroundColor, accentColor] = useThemeColor(["default-foreground", "accent"]);
  const { isLineSaved, toggleSavedLine } = useSavedLines();
  const saved = isLineSaved(line.id);
  const ShareIcon = Platform.OS === "ios" ? Share : Share2;

  function toggleSaved() {
    if (saved) haptics.toggleOff();
    else haptics.toggleOn();
    toggleSavedLine(line.id);
  }

  function share() {
    haptics.tap();
    const url = lineUrl(line.id);
    // iOS shares the link on its own; Android only shares the message.
    void NativeShare.share(
      Platform.OS === "ios"
        ? { url, message: `${line.name} on Rail Radar` }
        : { message: `${line.name} on Rail Radar\n${url}`, title: line.name },
    ).catch(() => {});
  }

  return (
    <View className="mt-3 flex-row gap-2">
      <Button
        accessibilityLabel={saved ? "Remove from saved lines" : "Save line"}
        accessibilityState={{ selected: saved }}
        className="flex-1"
        size="sm"
        variant={saved ? "secondary" : "tertiary"}
        onPress={toggleSaved}
      >
        <Bookmark
          size={16}
          color={saved ? accentColor : foregroundColor}
          fill={saved ? accentColor : "none"}
        />
        <Button.Label>{saved ? "Saved" : "Save"}</Button.Label>
      </Button>
      <Button className="flex-1" size="sm" variant="tertiary" onPress={share}>
        <ShareIcon size={16} color={foregroundColor} />
        <Button.Label>Share</Button.Label>
      </Button>
    </View>
  );
});

/** The line's color at 18%, like the web's selected chips. */
function tint(color: string) {
  return /^#[\da-f]{6}$/i.test(color) ? `${color}2e` : "transparent";
}

/**
 * One chip per branch, named after where it goes, under a title saying the line splits. The
 * chosen branch's stops are the ones listed below and marked on the map.
 */
function BranchPicker({
  line,
  branch,
  stationsById,
  onChange,
}: {
  line: Line;
  branch: number;
  stationsById: ReadonlyMap<string, Station> | null;
  onChange: (branch: number) => void;
}) {
  const mutedColor = useThemeColor("muted");
  if (line.routes.length < 2) return null;
  const color = getLineColor(line);

  return (
    <View className="mt-4">
      <View className="mb-2 flex-row items-center gap-1.5">
        <Split size={14} color={mutedColor} />
        <Text className="text-sm font-medium text-muted">
          {line.routes.length} branches · pick one to see its stops
        </Text>
      </View>
      {/* Out to the sheet's edges, so the chips scroll under them instead of stopping short. */}
      <View className="-mx-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="tablist"
          accessibilityLabel="Branches"
          contentContainerStyle={styles.branchChips}
        >
          {line.routes.map((route, index) => {
            const isSelected = index === branch;
            const label = stationsById
              ? getBranchLabel(line.routes, route, stationsById)
              : `Branch ${index + 1}`;
            return (
              <PressableFeedback
                key={index}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Branch ${label}`}
                className={`h-9 flex-row items-center gap-1.5 rounded-full px-3.5 ${isSelected ? "" : "bg-default"}`}
                style={
                  isSelected
                    ? { backgroundColor: tint(color), borderColor: color, borderWidth: 1.5 }
                    : undefined
                }
                onPress={() => {
                  if (isSelected) return;
                  haptics.selection();
                  onChange(index);
                }}
              >
                <View
                  style={[
                    styles.branchDot,
                    isSelected
                      ? { backgroundColor: color }
                      : { borderColor: mutedColor, borderWidth: 1.5 },
                  ]}
                />
                {route.code ? (
                  <Text className="text-sm font-semibold text-foreground">{route.code}</Text>
                ) : null}
                <Text
                  className={`text-sm ${isSelected ? "font-medium text-foreground" : "text-muted"}`}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </PressableFeedback>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

/** The strip in the line's color down the side of the stops, with each stop's dot on it. */
function StopStrip({
  color,
  isFirst,
  isLast,
  isTerminus,
}: {
  color: string;
  isFirst: boolean;
  isLast: boolean;
  isTerminus: boolean;
}) {
  const surfaceColor = useThemeColor("surface");
  return (
    <View className="w-6 items-center justify-center" importantForAccessibility="no">
      <View
        style={[
          styles.stripBar,
          { backgroundColor: color, top: isFirst ? "50%" : 0, bottom: isLast ? "50%" : 0 },
        ]}
      />
      <View
        style={[
          isTerminus ? styles.terminusDot : styles.stopDot,
          { borderColor: color, backgroundColor: surfaceColor },
        ]}
      />
    </View>
  );
}

interface StopItem {
  type: "stop";
  key: string;
  station: Station;
  isFirst: boolean;
  isLast: boolean;
}

/** Stops left out until the list is expanded. */
interface GapItem {
  type: "gap";
  key: string;
  /** Where the hidden stops start among all of the route's stops. */
  from: number;
  count: number;
}

type ListItem = StopItem | GapItem;

/** The other lines at a stop, and a train icon if it's a train station. */
function StopConnections({ station, line }: { station: Station; line: Line }) {
  const interchanges = getStationLines(station.id).filter((other) => other.id !== line.id);
  if (station.type !== "rail" && interchanges.length === 0) return null;
  return (
    <View className="shrink-0 flex-row items-center gap-1">
      {interchanges.map((other) => (
        <LineBadge key={other.id} line={other} size="sm" />
      ))}
      {station.type === "rail" ? (
        <Image
          accessible
          accessibilityLabel="Train station"
          source={stationIcons.rail}
          style={styles.railIcon}
        />
      ) : null}
    </View>
  );
}

const LineStop = memo(function LineStop({
  item,
  line,
  color,
  isHighlighted,
  onSelect,
}: {
  item: StopItem;
  line: Line;
  color: string;
  isHighlighted: boolean;
  onSelect: (station: Station) => void;
}) {
  const { station, isFirst, isLast } = item;
  const isTerminus = isFirst || isLast;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isHighlighted }}
      className="flex-row px-4 active:bg-surface-tertiary"
      onPress={() => onSelect(station)}
    >
      <StopStrip color={color} isFirst={isFirst} isLast={isLast} isTerminus={isTerminus} />
      <View className="ml-3 min-h-11 flex-1 flex-row items-center gap-2 py-1.5">
        <Text
          className={`flex-1 text-sm text-foreground ${isHighlighted ? "font-semibold" : isTerminus ? "font-medium" : ""}`}
          numberOfLines={1}
        >
          {shortStationName(station.name)}
        </Text>
        <StopConnections station={station} line={line} />
      </View>
    </Pressable>
  );
});

/** Dots down the strip where stops are left out; pressing them shows every stop. */
function HiddenStopsRow({
  count,
  color,
  onExpand,
}: {
  count: number;
  color: string;
  onExpand: () => void;
}) {
  const mutedColor = useThemeColor("muted");
  const label = `${count} more stops`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Show ${label}`}
      className="flex-row px-4 active:bg-surface-tertiary"
      onPress={onExpand}
    >
      <View className="w-6 items-center justify-center gap-1" importantForAccessibility="no">
        {[0, 1, 2].map((dot) => (
          <View key={dot} style={[styles.gapDot, { backgroundColor: color }]} />
        ))}
      </View>
      <View className="ml-3 min-h-11 flex-1 flex-row items-center gap-1">
        <Text className="text-sm text-muted">{label}</Text>
        <ChevronsUpDown size={14} color={mutedColor} />
      </View>
    </Pressable>
  );
}

function StopsSkeleton({ color }: { color: string }) {
  return (
    <View accessibilityLabel="Loading stops">
      {Array.from({ length: skeletonStopCount }, (_, index) => (
        <View key={index} className="flex-row px-4" importantForAccessibility="no-hide-descendants">
          <StopStrip
            color={color}
            isFirst={index === 0}
            isLast={index === skeletonStopCount - 1}
            isTerminus={index === 0}
          />
          <View className="ml-3 min-h-11 flex-1 justify-center">
            <Skeleton
              className="h-3.5 rounded-full"
              style={{ width: `${40 + ((index * 23) % 35)}%` }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

function LineAbout({ line }: { line: Line }) {
  const mutedColor = useThemeColor("muted");
  if (!line.description) return null;
  return (
    <View className="mt-5 px-4">
      <SectionTitle icon={<Info size={14} color={mutedColor} />}>About</SectionTitle>
      <Surface variant="secondary" className="rounded-3xl p-4">
        <Text className="text-sm leading-5 text-foreground">{line.description}</Text>
      </Surface>
    </View>
  );
}

function itemKey(item: ListItem) {
  return item.key;
}

interface LineSheetContentProps {
  line: Line;
  stationsUrl: string | null;
  /** The stop the line was opened from, highlighted among the others. */
  fromStationId: string | null;
  /** Which of the line's routes is shown. */
  branch: number;
  /** Whether the sheet is at its top step, the only one its list scrolls at. */
  isExtended: boolean;
  onBranchChange: (branch: number) => void;
  onClose: () => void;
  onSelectStation: (station: Station) => void;
  onContentHeightChange: (height: number) => void;
}

function LineSheetContent({
  line,
  stationsUrl,
  fromStationId,
  branch,
  isExtended,
  onBranchChange,
  onClose,
  onSelectStation,
  onContentHeightChange,
}: LineSheetContentProps) {
  const bottomInset = useSheetBottomInset();
  const stationsById = useStationsById(stationsUrl);
  const color = getLineColor(line);
  // Starts with the termini and the stops around the one the line was opened from. Each run of
  // dots expands on its own, so the stops around that one stay where they are.
  const [expandedGaps, setExpandedGaps] = useState<ReadonlySet<string>>(() => new Set());
  const { expand: expandSheet } = useBottomSheet();
  // Stops shown above the stop the line was opened from push it down, so the list follows it.
  const [isFollowingFocus, setIsFollowingFocus] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [scrollRef, scrollOffset] = useSheetScrollOffset<FlatList<ListItem>>();
  const route = line.routes[branch] ?? line.routes[0];

  const stops = useMemo(() => {
    if (!route || !stationsById) return null;
    const stations = getRouteStops(route, stationsById);
    const toItem = (index: number): StopItem => ({
      type: "stop",
      // A loop comes back to where it started.
      key: `${stations[index]!.id}-${index}`,
      station: stations[index]!,
      isFirst: index === 0,
      isLast: index === stations.length - 1,
    });
    const focusIndex = stations.findIndex(({ id }) => id === fromStationId);
    return collapseStops(stations.length, focusIndex).flatMap((entry): ListItem[] => {
      if (typeof entry === "number") return [toItem(entry)];
      if (expandedGaps.has(`${branch}:${entry.from}`)) {
        return Array.from({ length: entry.count }, (_, offset) => toItem(entry.from + offset));
      }
      return [{ type: "gap", key: `gap-${entry.from}`, from: entry.from, count: entry.count }];
    });
  }, [route, stationsById, fromStationId, expandedGaps, branch]);

  // Taller too, since the stops are what the dots were tapped for.
  const expandGap = useCallback(
    (from: number) => {
      haptics.tap();
      setExpandedGaps((gaps) => new Set(gaps).add(`${branch}:${from}`));
      const focusIndex = route?.stations.indexOf(fromStationId ?? "") ?? -1;
      if (from < focusIndex) setIsFollowingFocus(true);
      expandSheet();
    },
    [branch, route, fromStationId, expandSheet],
  );

  // Once the sheet is tall enough to scroll, with the stops before it in view.
  useEffect(() => {
    if (!isFollowingFocus || !isExtended || !stops) return;
    setIsFollowingFocus(false);
    const index = stops.findIndex(
      (item) => item.type === "stop" && item.station.id === fromStationId,
    );
    if (index === -1) return;
    scrollRef.current?.scrollToIndex({
      index,
      viewOffset: headerHeight + stopsTopSpacing + stopsAboveFocus * stopRowHeight,
      animated: true,
    });
  }, [isFollowingFocus, isExtended, stops, fromStationId, headerHeight, scrollRef]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ListItem>) =>
      item.type === "gap" ? (
        <HiddenStopsRow count={item.count} color={color} onExpand={() => expandGap(item.from)} />
      ) : (
        <LineStop
          item={item}
          line={line}
          color={color}
          isHighlighted={item.station.id === fromStationId}
          onSelect={onSelectStation}
        />
      ),
    [line, color, fromStationId, onSelectStation, expandGap],
  );

  return (
    <View style={styles.fill}>
      <PinnedSheetHeader onHeightChange={setHeaderHeight}>
        <View className="px-4">
          <SheetHeader
            title={line.name}
            titleLines={2}
            closeLabel="Close line"
            onClose={onClose}
            leading={<LineBadge line={line} size="lg" />}
          >
            <LineSubtitle line={line} />
          </SheetHeader>
          <QuickActions line={line} />
          <BranchPicker
            line={line}
            branch={branch}
            stationsById={stationsById}
            onChange={onBranchChange}
          />
        </View>
        <SheetHeaderFade scrollOffset={scrollOffset} />
      </PinnedSheetHeader>
      <BottomSheetFlatList
        // Gorhom forwards the RN FlatList instance; its declared ref exposes only list methods.
        ref={scrollRef as Ref<BottomSheetFlatListMethods>}
        data={stops ?? []}
        keyExtractor={itemKey}
        renderItem={renderItem}
        initialNumToRender={16}
        // Stops further down than the rendered ones have no measured position yet.
        onScrollToIndexFailed={({ index, averageItemLength }) =>
          scrollRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true })
        }
        removeClippedSubviews={false}
        contentContainerStyle={{
          paddingTop: headerHeight + stopsTopSpacing,
          paddingBottom: bottomInset,
        }}
        scrollIndicatorInsets={{ top: headerHeight }}
        onContentSizeChange={(_, height) => onContentHeightChange(height)}
        ListHeaderComponent={
          !stops ? (
            <StopsSkeleton color={color} />
          ) : stops.length === 0 ? (
            <StatusMessage
              icon={CircleAlert}
              title="No stops to show"
              description="This line's stops couldn't be loaded."
            />
          ) : null
        }
        ListFooterComponent={<LineAbout line={line} />}
      />
    </View>
  );
}

/** Shown in the sheet if the line fails to render, so the map stays usable. */
function LineError({
  line,
  onRetry,
  onClose,
}: {
  line: Line;
  onRetry: () => void;
  onClose: () => void;
}) {
  const bottomInset = useSheetBottomInset();

  return (
    <BottomSheetView className="gap-2 px-4" style={{ paddingBottom: bottomInset }}>
      <SheetHeader title={line.name} titleLines={2} closeLabel="Close line" onClose={onClose} />
      <StatusMessage
        icon={CircleAlert}
        title="Something went wrong"
        description="This line couldn't be shown."
        onRetry={onRetry}
      />
    </BottomSheetView>
  );
}

interface LineSheetProps {
  line: Line;
  isOpen: boolean;
  /** The station GeoJSON the map shows, which names the line's stops. */
  stationsUrl: string | null;
  fromStationId: string | null;
  branch: number;
  onBranchChange: (branch: number) => void;
  onOpenChange: (isOpen: boolean) => void;
  onSelectStation: (station: Station) => void;
  /** Where the sheet is, for the map controls that sit above it. */
  position: SheetPosition;
}

/** A metro or light rail line: its stops in order, from the data bundled with the app. */
export function LineSheet({
  line,
  isOpen,
  stationsUrl,
  fromStationId,
  branch,
  onBranchChange,
  onOpenChange,
  onSelectStation,
  position,
}: LineSheetProps) {
  const topInset = useSheetTopInset();
  const { height: screenHeight } = useWindowDimensions();
  const sheetRef = useRef<BottomSheet>(null);
  const [index, setIndex] = useState(-1);
  const [contentHeight, setContentHeight] = useState(0);
  // Like the station sheet: as tall as its content, with a step in between for long lines.
  const hasMiddleStep =
    contentHeight === 0 ||
    handleHeight + contentHeight > (screenHeight - topInset) * middleStep + minStepGap;
  const [surfaceColor, mutedColor] = useThemeColor(["surface", "muted"]);

  // The sheet mounts open, since calls made before it has measured itself are dropped.
  const [initialIndex] = useState(isOpen ? 0 : -1);
  const isMounted = useRef(false);

  // Opens at the middle step on every line, including when picking another one.
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    if (isOpen) sheetRef.current?.snapToIndex(0);
    else sheetRef.current?.close();
  }, [isOpen, line.id]);

  // Android back shrinks the sheet back to its middle step, then closes it.
  useEffect(() => {
    if (!isOpen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (index > 0) sheetRef.current?.snapToIndex(0);
      else onOpenChange(false);
      return true;
    });
    return () => subscription.remove();
  }, [isOpen, index, onOpenChange]);

  return (
    <BottomSheet
      ref={sheetRef}
      index={initialIndex}
      // No smaller step: the stops are what the sheet is for. A short line opens as tall as its
      // content, which the sheet sizes itself to.
      snapPoints={hasMiddleStep ? [`${middleStep * 100}%`] : undefined}
      topInset={topInset}
      animatedIndex={position.animatedIndex}
      animatedPosition={position.animatedPosition}
      enableOverDrag={false}
      enablePanDownToClose
      backgroundStyle={[sheetBackgroundStyle, { backgroundColor: surfaceColor }]}
      handleIndicatorStyle={{ backgroundColor: mutedColor }}
      onChange={(next) => {
        setIndex(next);
        if (next === -1 && isOpen) onOpenChange(false);
      }}
    >
      <ErrorBoundary
        key={`${line.id}:${fromStationId}`}
        fallback={(reset) => (
          <LineError line={line} onRetry={reset} onClose={() => onOpenChange(false)} />
        )}
      >
        <LineSheetContent
          line={line}
          stationsUrl={stationsUrl}
          fromStationId={fromStationId}
          branch={branch}
          isExtended={index === (hasMiddleStep ? 1 : 0)}
          onBranchChange={onBranchChange}
          onClose={() => onOpenChange(false)}
          onSelectStation={onSelectStation}
          onContentHeightChange={setContentHeight}
        />
      </ErrorBoundary>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  branchChips: { gap: 8, paddingHorizontal: 16 },
  branchDot: { width: 8, height: 8, borderRadius: 4 },
  gapDot: { width: 4, height: 4, borderRadius: 2 },
  stripBar: { position: "absolute", width: 6 },
  stopDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3 },
  terminusDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 4 },
  railIcon: { width: 18, height: 18 },
});
