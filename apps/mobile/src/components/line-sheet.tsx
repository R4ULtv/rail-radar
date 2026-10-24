import { COUNTRY_MAP } from "@repo/data/countries";
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
import { ListGroup } from "heroui-native/list-group";
import { Separator } from "heroui-native/separator";
import Bookmark from "lucide-react-native/icons/bookmark";
import ChevronsUpDown from "lucide-react-native/icons/chevrons-up-down";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import GitCommitVertical from "lucide-react-native/icons/git-commit-vertical";
import Info from "lucide-react-native/icons/info";
import Route from "lucide-react-native/icons/route";
import Share from "lucide-react-native/icons/share";
import Share2 from "lucide-react-native/icons/share-2";
import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type Ref } from "react";
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

import { CountryFlag } from "@/components/country-flag";
import { ErrorBoundary } from "@/components/error-boundary";
import { LineBadge } from "@/components/line-badge";
import { LineDiagram } from "@/components/line-diagram";
import {
  useSheetBottomInset,
  useSheetTopInset,
  type SheetCloseAction,
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
import { AboutRow, ReportLinks } from "@/components/station-details";
import { RowSeparator, SectionTitle } from "@/components/station-list";
import { middleStep } from "@/components/station-sheet";
import { StatusMessage } from "@/components/status-message";
import { useSavedLines } from "@/hooks/use-saved-lines";
import { useStationsById } from "@/hooks/use-stations-by-id";
import { haptics } from "@/lib/haptics";
import {
  collapseStops,
  getLineBadgeCode,
  getLineColor,
  getLineCountry,
  getLineOperatorName,
  getLineStopCount,
  getRouteLabels,
  getRouteStopCount,
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
const skeletonStopCount = 6;

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

/** A radio for a route in the open card, and a plain dot in the line's color otherwise. */
function RouteMark({ color, kind }: { color: string; kind: "dot" | "selected" | "unselected" }) {
  const mutedColor = useThemeColor("muted");
  if (kind === "dot") {
    return (
      <View className="size-5 items-center justify-center">
        <View style={[styles.routeDot, { backgroundColor: color }]} />
      </View>
    );
  }
  return (
    <View
      className="size-5 items-center justify-center rounded-full"
      style={{ borderWidth: 2, borderColor: kind === "selected" ? color : mutedColor }}
    >
      {kind === "selected" ? <View style={[styles.routeDot, { backgroundColor: color }]} /> : null}
    </View>
  );
}

/**
 * The line's routes in a card, named after their ends. Closed, it shows the chosen one; a line
 * with more than one opens it to a list to pick from. The chosen route's stops are the ones listed
 * below and marked on the map.
 */
function LineRoutes({
  line,
  branch,
  stationsById,
  isOpen,
  onToggle,
  onChange,
}: {
  line: Line;
  branch: number;
  stationsById: ReadonlyMap<string, Station>;
  isOpen: boolean;
  onToggle: () => void;
  /** Picks another route, which closes the card too. */
  onChange: (branch: number) => void;
}) {
  const mutedColor = useThemeColor("muted");
  const color = getLineColor(line);
  const labels = useMemo(
    () => getRouteLabels(line.routes, stationsById),
    [line.routes, stationsById],
  );
  const routeCount = line.routes.length;
  const canChoose = routeCount > 1;
  const shown = isOpen ? line.routes.map((_, index) => index) : [branch];

  return (
    <View className="mt-5">
      <SectionTitle icon={<Route size={14} color={mutedColor} />}>
        {routeCount === 1 ? "1 route" : `${routeCount} routes`}
      </SectionTitle>
      {/* Clipped, so a pressed first or last row keeps the rounded corners. */}
      <ListGroup
        variant="secondary"
        className="overflow-hidden"
        accessibilityRole={isOpen ? "radiogroup" : undefined}
      >
        {shown.map((index, position) => {
          const route = line.routes[index]!;
          const { title, via } = labels[index]!;
          const stopCount = getRouteStopCount(route, stationsById);
          const description = [
            via ? `via ${via}` : null,
            `${stopCount} ${stopCount === 1 ? "stop" : "stops"}`,
          ]
            .filter(Boolean)
            .join(" · ");
          const isSelected = index === branch;

          return (
            <Fragment key={index}>
              {position > 0 ? <RowSeparator /> : null}
              <ListGroup.Item
                accessibilityRole={isOpen ? "radio" : canChoose ? "button" : undefined}
                accessibilityState={isOpen ? { checked: isSelected } : undefined}
                accessibilityHint={!isOpen && canChoose ? "Shows the other routes" : undefined}
                className="active:bg-surface-tertiary"
                disabled={!canChoose}
                onPress={() => {
                  if (isOpen && !isSelected) {
                    haptics.selection();
                    onChange(index);
                  } else {
                    haptics.tap();
                    onToggle();
                  }
                }}
              >
                <ListGroup.ItemPrefix>
                  <RouteMark
                    color={color}
                    kind={isOpen ? (isSelected ? "selected" : "unselected") : "dot"}
                  />
                </ListGroup.ItemPrefix>
                <ListGroup.ItemContent>
                  <View className="flex-row items-center gap-1.5">
                    {route.code ? (
                      <ListGroup.ItemTitle className="font-semibold">
                        {route.code}
                      </ListGroup.ItemTitle>
                    ) : null}
                    <ListGroup.ItemTitle numberOfLines={2} className="shrink">
                      {title}
                    </ListGroup.ItemTitle>
                  </View>
                  <ListGroup.ItemDescription numberOfLines={1}>
                    {description}
                  </ListGroup.ItemDescription>
                </ListGroup.ItemContent>
                {!isOpen && canChoose ? (
                  <ListGroup.ItemSuffix>
                    <ChevronsUpDown size={16} color={mutedColor} />
                  </ListGroup.ItemSuffix>
                ) : null}
              </ListGroup.Item>
            </Fragment>
          );
        })}
      </ListGroup>
    </View>
  );
}

/**
 * Over the stops: what they're around while some are left out, and a link to show them all.
 */
function StopsTitle({
  focusName,
  stopCount,
  hasHiddenStops,
  onShowAll,
}: {
  focusName: string | null;
  stopCount: number;
  hasHiddenStops: boolean;
  onShowAll: () => void;
}) {
  const mutedColor = useThemeColor("muted");
  const allLabel = `All ${stopCount} stops`;
  return (
    <View className="mt-5 flex-row items-center justify-between pr-4">
      <View className="shrink">
        <SectionTitle icon={<GitCommitVertical size={14} color={mutedColor} />}>
          {hasHiddenStops && focusName
            ? `Around ${focusName}`
            : `${stopCount} ${stopCount === 1 ? "stop" : "stops"}`}
        </SectionTitle>
      </View>
      {hasHiddenStops ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Show all ${stopCount} stops`}
          hitSlop={8}
          className="mb-2 active:opacity-60"
          onPress={onShowAll}
        >
          <Text className="text-sm font-medium text-foreground">{allLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The strip in the line's color down the side of the stops, with each stop's dot on it. The
 * termini have a bigger one, and the stop the line was opened from a dot inside it too.
 */
function StopStrip({
  color,
  isFirst,
  isLast,
  dot,
}: {
  color: string;
  isFirst: boolean;
  isLast: boolean;
  dot: "small" | "big" | "focus";
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
          dot === "small" ? styles.stopDot : styles.bigDot,
          { borderColor: color, backgroundColor: surfaceColor },
        ]}
      >
        {dot === "focus" ? <View style={[styles.focusDot, { backgroundColor: color }]} /> : null}
      </View>
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

/** The diagram, the routes and the stops' title, in the list so they scroll with the stops. */
interface IntroItem {
  type: "intro";
  key: string;
}

const introItem: IntroItem = { type: "intro", key: "intro" };

type ListItem = IntroItem | StopItem | GapItem;

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
      <StopStrip
        color={color}
        isFirst={isFirst}
        isLast={isLast}
        dot={isHighlighted ? "focus" : isTerminus ? "big" : "small"}
      />
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

/** Dots down the strip where stops are left out; pressing them shows those stops. */
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
    <View accessibilityLabel="Loading stops" className="mt-5">
      {Array.from({ length: skeletonStopCount }, (_, index) => (
        <View key={index} className="flex-row px-4" importantForAccessibility="no-hide-descendants">
          <StopStrip
            color={color}
            isFirst={index === 0}
            isLast={index === skeletonStopCount - 1}
            dot={index === 0 || index === skeletonStopCount - 1 ? "big" : "small"}
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

/** Like a station's About: the line's description, who runs it and where. */
function LineAbout({ line }: { line: Line }) {
  const mutedColor = useThemeColor("muted");
  const operator = getLineOperatorName(line);
  const countryCode = getLineCountry(line);
  const country = countryCode ? COUNTRY_MAP[countryCode] : null;
  const rows = [
    operator ? (
      <AboutRow key="operator" label="Operator">
        <Text className="text-sm text-foreground">{operator}</Text>
      </AboutRow>
    ) : null,
    country ? (
      <AboutRow key="country" label="Country">
        <View className="flex-row items-center gap-2">
          <CountryFlag country={countryCode} />
          <Text className="text-sm text-foreground">{country}</Text>
        </View>
      </AboutRow>
    ) : null,
  ].filter((row) => row !== null);

  return (
    <View className="px-4">
      {line.description || rows.length > 0 ? (
        <View className="mt-5">
          <SectionTitle icon={<Info size={14} color={mutedColor} />}>About</SectionTitle>
          <ListGroup variant="secondary">
            {line.description ? (
              <Text className="px-4 py-3.5 text-sm leading-5 text-foreground">
                {line.description}
              </Text>
            ) : null}
            {rows.map((row, index) => (
              <Fragment key={row.key}>
                {index > 0 || line.description ? <Separator className="mx-4" /> : null}
                {row}
              </Fragment>
            ))}
          </ListGroup>
        </View>
      ) : null}
      <ReportLinks mutedColor={mutedColor} />
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
  const [isRoutesOpen, setIsRoutesOpen] = useState(false);
  const { expand: expandSheet } = useBottomSheet();
  // Dots above the stop the line was opened from wait for the top step to show their stops: the
  // list only scrolls there, which it does to keep that stop still as they're added above it.
  const [pendingGap, setPendingGap] = useState<number | null>(null);
  // What the list keeps still as rows above it change: the first one on screen, so the routes
  // card and the stops push what's below them down, or that stop while dots above it open. iOS
  // picks the row before each change, so it's switched to that stop a render before the stops
  // are added, and the setting stays on throughout: turned back on, it'd go by a row it picked
  // before it was off.
  const [anchorsFocus, setAnchorsFocus] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [scrollRef, scrollOffset] = useSheetScrollOffset<FlatList<ListItem>>();
  const route = line.routes[branch] ?? line.routes[0];

  const list = useMemo(() => {
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
    // Among the stops the stations know, like the gaps' positions.
    const focusIndex = stations.findIndex(({ id }) => id === fromStationId);
    const entries = collapseStops(stations.length, focusIndex);
    const stops = entries.flatMap((entry): ListItem[] => {
      if (typeof entry === "number") return [toItem(entry)];
      if (expandedGaps.has(`${branch}:${entry.from}`)) {
        return Array.from({ length: entry.count }, (_, offset) => toItem(entry.from + offset));
      }
      return [{ type: "gap", key: `gap-${entry.from}`, from: entry.from, count: entry.count }];
    });
    const focusStopIndex = stops.findIndex(
      (item) => item.type === "stop" && item.station.id === fromStationId,
    );
    return {
      stops,
      focusIndex,
      // After the intro, which comes first.
      focusItemIndex: focusStopIndex >= 0 ? focusStopIndex + 1 : -1,
      focusName: focusIndex >= 0 ? shortStationName(stations[focusIndex]!.name) : null,
      gaps: entries.flatMap((entry) => (typeof entry === "number" ? [] : [entry.from])),
    };
  }, [route, stationsById, fromStationId, expandedGaps, branch]);
  const stops = list?.stops ?? null;
  const focusIndex = list?.focusIndex ?? -1;
  const focusItemIndex = list?.focusItemIndex ?? -1;
  const hasHiddenStops = stops?.some((item) => item.type === "gap") ?? false;
  const items = useMemo((): ListItem[] => [introItem, ...(stops ?? [])], [stops]);

  const showGap = useCallback(
    (from: number) => setExpandedGaps((gaps) => new Set(gaps).add(`${branch}:${from}`)),
    [branch],
  );

  // Taller too, since the stops are what the dots were tapped for.
  const expandGap = useCallback(
    (from: number) => {
      haptics.tap();
      if (from < focusIndex) {
        setAnchorsFocus(true);
        setPendingGap(from);
      } else showGap(from);
      expandSheet();
    },
    [focusIndex, showGap, expandSheet],
  );

  // Once the list keeps that stop still, and scrolls.
  useEffect(() => {
    if (pendingGap === null || !isExtended || !anchorsFocus) return;
    setPendingGap(null);
    showGap(pendingGap);
  }, [pendingGap, isExtended, anchorsFocus, showGap]);

  // Back to the first row on screen once they're shown.
  useEffect(() => {
    if (anchorsFocus && pendingGap === null) setAnchorsFocus(false);
  }, [anchorsFocus, pendingGap, expandedGaps]);

  const showAllStops = useCallback(() => {
    if (!list) return;
    haptics.tap();
    setExpandedGaps((expanded) => {
      const next = new Set(expanded);
      for (const from of list.gaps) next.add(`${branch}:${from}`);
      return next;
    });
    expandSheet();
  }, [list, branch, expandSheet]);

  const toggleRoutes = useCallback(() => setIsRoutesOpen((open) => !open), []);

  const changeBranch = useCallback(
    (next: number) => {
      onBranchChange(next);
      setIsRoutesOpen(false);
    },
    [onBranchChange],
  );

  const intro =
    !stops || !stationsById ? (
      <StopsSkeleton color={color} />
    ) : (
      <>
        <View className="px-4">
          <LineDiagram
            line={line}
            branch={branch}
            fromStationId={fromStationId}
            stationsById={stationsById}
          />
          <LineRoutes
            line={line}
            branch={branch}
            stationsById={stationsById}
            isOpen={isRoutesOpen}
            onToggle={toggleRoutes}
            onChange={changeBranch}
          />
        </View>
        {stops.length === 0 ? (
          <StatusMessage
            icon={CircleAlert}
            title="No stops to show"
            description="This line's stops couldn't be loaded."
          />
        ) : (
          <View className="px-4">
            <StopsTitle
              focusName={list?.focusName ?? null}
              stopCount={route ? getRouteStopCount(route, stationsById) : 0}
              hasHiddenStops={hasHiddenStops}
              onShowAll={showAllStops}
            />
          </View>
        )}
      </>
    );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ListItem>) => {
      switch (item.type) {
        case "intro":
          return intro;
        case "gap":
          return (
            <HiddenStopsRow
              count={item.count}
              color={color}
              onExpand={() => expandGap(item.from)}
            />
          );
        default:
          return (
            <LineStop
              item={item}
              line={line}
              color={color}
              isHighlighted={item.station.id === fromStationId}
              onSelect={onSelectStation}
            />
          );
      }
    },
    [intro, line, color, fromStationId, onSelectStation, expandGap],
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
            // Like a station's icon: only lines with a code get a badge, since a plain square of
            // color says nothing the stops' strip doesn't.
            leading={getLineBadgeCode(line) ? <LineBadge line={line} size="lg" /> : undefined}
          >
            <LineSubtitle line={line} />
          </SheetHeader>
          <QuickActions line={line} />
        </View>
        <SheetHeaderFade scrollOffset={scrollOffset} />
      </PinnedSheetHeader>
      <BottomSheetFlatList
        // Gorhom forwards the RN FlatList instance; its declared ref exposes only list methods.
        ref={scrollRef as Ref<BottomSheetFlatListMethods>}
        data={items}
        keyExtractor={itemKey}
        renderItem={renderItem}
        initialNumToRender={16}
        maintainVisibleContentPosition={{
          minIndexForVisible: anchorsFocus && focusItemIndex >= 0 ? focusItemIndex : 0,
        }}
        removeClippedSubviews={false}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: bottomInset }}
        scrollIndicatorInsets={{ top: headerHeight }}
        onContentSizeChange={(_, height) => onContentHeightChange(height)}
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
  /**
   * Changes each time the line is opened afresh, which starts its sheet over. The same key when
   * it's opened again shows it as it was left, e.g. coming back from one of its stops.
   */
  openKey: number;
  isOpen: boolean;
  /** The station GeoJSON the map shows, which names the line's stops. */
  stationsUrl: string | null;
  fromStationId: string | null;
  branch: number;
  onBranchChange: (branch: number) => void;
  onClose: (action: SheetCloseAction) => void;
  onSelectStation: (station: Station) => void;
  /** Where the sheet is, for the map controls that sit above it. */
  position: SheetPosition;
}

/** A metro or light rail line: its stops in order, from the data bundled with the app. */
export function LineSheet({
  line,
  openKey,
  isOpen,
  stationsUrl,
  fromStationId,
  branch,
  onBranchChange,
  onClose,
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
  // The step it was last open at, and for which opening.
  const lastStep = useRef({ openKey, index: 0 });

  // A fresh opening starts at the middle step; coming back goes to the step it was left at, since
  // its list keeps its scroll and only scrolls at the top step.
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    if (!isOpen) {
      sheetRef.current?.close();
      return;
    }
    const isReturning = lastStep.current.openKey === openKey;
    sheetRef.current?.snapToIndex(isReturning ? lastStep.current.index : 0);
  }, [isOpen, openKey]);

  // Android back shrinks the sheet back to its middle step, then closes it.
  useEffect(() => {
    if (!isOpen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (index > 0) sheetRef.current?.snapToIndex(0);
      else onClose("back");
      return true;
    });
    return () => subscription.remove();
  }, [isOpen, index, onClose]);

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
        if (next >= 0) lastStep.current = { openKey, index: next };
        if (next === -1 && isOpen) onClose("dismiss");
      }}
    >
      <ErrorBoundary
        key={openKey}
        fallback={(reset) => (
          <LineError line={line} onRetry={reset} onClose={() => onClose("back")} />
        )}
      >
        <LineSheetContent
          line={line}
          stationsUrl={stationsUrl}
          fromStationId={fromStationId}
          branch={branch}
          isExtended={index === (hasMiddleStep ? 1 : 0)}
          onBranchChange={onBranchChange}
          onClose={() => onClose("back")}
          onSelectStation={onSelectStation}
          onContentHeightChange={setContentHeight}
        />
      </ErrorBoundary>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  gapDot: { width: 4, height: 4, borderRadius: 2 },
  stripBar: { position: "absolute", width: 6 },
  stopDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 3 },
  bigDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  focusDot: { width: 4, height: 4, borderRadius: 2 },
  railIcon: { width: 18, height: 18 },
});
