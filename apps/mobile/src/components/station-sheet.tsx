import { getCountry } from "@repo/data/countries";
import type { Station } from "@repo/data/types";
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from "@gorhom/bottom-sheet";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { Tabs } from "heroui-native/tabs";
import ArrowDownLeft from "lucide-react-native/icons/arrow-down-left";
import ArrowUpRight from "lucide-react-native/icons/arrow-up-right";
import Bookmark from "lucide-react-native/icons/bookmark";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import CloudOff from "lucide-react-native/icons/cloud-off";
import CornerUpRight from "lucide-react-native/icons/corner-up-right";
import Megaphone from "lucide-react-native/icons/megaphone";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import Share from "lucide-react-native/icons/share";
import Share2 from "lucide-react-native/icons/share-2";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from "react";
import {
  BackHandler,
  Linking,
  Platform,
  Share as NativeShare,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from "react-native";
// Gesture handler's, so it settles horizontal drags with the sheet's own pan gesture on Android.
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from "react-native-svg";

import { CountryFlag } from "@/components/country-flag";
import {
  NearbyIcon,
  useSheetBottomInset,
  useSheetTopInset,
  type SheetPosition,
} from "@/components/map-controls";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  PinnedSheetHeader,
  sheetBackgroundStyle,
  SheetHeader,
  SheetHeaderFade,
  useSheetScrollOffset,
} from "@/components/sheet-header";
import { StationDetails } from "@/components/station-details";
import { StatusMessage } from "@/components/status-message";
import { TrainRow, TrainRowSeparator, TrainRowSkeleton, trainKey } from "@/components/train-row";
import { useStationBoard, type BoardType } from "@/hooks/use-station-board";
import { useSavedStations } from "@/hooks/use-stored-stations";
import { distanceKm, formatDistance } from "@/lib/distance";
import { haptics } from "@/lib/haptics";
import { stationUrl } from "@/lib/links";
import type { NearbyStation } from "@/lib/stations";
import { getStationWarning } from "@/lib/station-warnings";
import type { UserLocation } from "@/lib/user-location";

const handleHeight = 24;
// Before the sheet has measured itself: the header, the tabs and one train.
const defaultStationPeekHeight = 300;
// The step between the peek and the fully open sheet, as a share of the screen.
export const middleStep = 0.6;
// How much further the content has to go for that step to be worth a stop.
const minStepGap = 80;
// Long boards are cut short so the station details below them stay in reach.
const collapsedTrainCount = 10;
// Between the tabs and the board, the same as between the actions and the tabs. It's still more
// than the header fade's gap.
const boardTopSpacing = 12;
const stationTypeLabels = {
  rail: "Train station",
  metro: "Metro station",
  light: "Light rail stop",
};

function formatUpdated(secondsAgo: number) {
  if (secondsAgo < 5) return "Updated just now";
  if (secondsAgo < 60) return `Updated ${secondsAgo}s ago`;
  return `Updated ${Math.floor(secondsAgo / 60)} min ago`;
}

/** "Updated 12s ago", ticking every second while the sheet is open. */
function useUpdatedLabel(
  timestamp: string | undefined,
  hasError: boolean,
  isOnline: boolean,
  isOpen: boolean,
) {
  const [, tick] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    if (!timestamp || !isOpen) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timestamp, isOpen]);

  if (!timestamp)
    return hasError ? (isOnline ? "Live trains unavailable" : "Offline") : "Updating…";
  const secondsAgo = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  return formatUpdated(secondsAgo);
}

interface StationSubtitleProps {
  station: Station;
  /** When the board was updated; only for train stations. */
  timestamp: string | undefined;
  hasError: boolean;
  isOnline: boolean;
  /** The label only ticks while the sheet is open. */
  isOpen: boolean;
  userLocation: UserLocation | null;
}

// Its own component, so the label's every-second tick only re-renders this line.
function StationSubtitle({
  station,
  timestamp,
  hasError,
  isOnline,
  isOpen,
  userLocation,
}: StationSubtitleProps) {
  const updatedLabel = useUpdatedLabel(timestamp, hasError, isOnline, isOpen);
  const distance =
    userLocation && station.geo ? formatDistance(distanceKm(userLocation, station.geo)) : null;
  const subtitle = [
    station.type === "rail" ? updatedLabel : stationTypeLabels[station.type],
    distance,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className="mt-1 flex-row items-center gap-1.5">
      <CountryFlag stationId={station.id} />
      <Text className="text-sm text-muted" numberOfLines={1} style={styles.tabularNums}>
        {subtitle}
      </Text>
    </View>
  );
}

function directionsUrl({ lat, lng }: NonNullable<Station["geo"]>) {
  return Platform.OS === "ios"
    ? `https://maps.apple.com/?daddr=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

const QuickActions = memo(function QuickActions({ station }: { station: Station }) {
  const [foregroundColor, accentColor] = useThemeColor(["default-foreground", "accent"]);
  const { isSaved, toggleSaved } = useSavedStations();
  const saved = isSaved(station.id);
  const ShareIcon = Platform.OS === "ios" ? Share : Share2;
  const isRail = station.type === "rail";
  // Saving is for live boards, which only train stations have. A stop saved before still shows
  // the button, so it can be removed.
  const canSave = isRail || saved;

  function toggleSavedStation() {
    if (saved) haptics.toggleOff();
    else haptics.toggleOn();
    toggleSaved(station);
  }

  function share() {
    haptics.tap();
    const url = stationUrl(station.id);
    // iOS shares the link on its own; Android only shares the message.
    void NativeShare.share(
      Platform.OS === "ios"
        ? { url, message: `${station.name} on Rail Radar` }
        : { message: `${station.name} on Rail Radar\n${url}`, title: station.name },
    ).catch(() => {});
  }

  if (!canSave && !station.geo) return null;
  return (
    <View className="mt-3 flex-row gap-2">
      {canSave ? (
        <Button
          accessibilityLabel={saved ? "Remove from saved stations" : "Save station"}
          accessibilityState={{ selected: saved }}
          className="flex-1"
          isDisabled={!station.geo}
          size="sm"
          variant={saved ? "secondary" : "tertiary"}
          onPress={toggleSavedStation}
        >
          <Bookmark
            size={16}
            color={saved ? accentColor : foregroundColor}
            fill={saved ? accentColor : "none"}
          />
          <Button.Label>{saved ? "Saved" : "Save"}</Button.Label>
        </Button>
      ) : null}
      {station.geo ? (
        <Button
          className="flex-1"
          size="sm"
          variant="tertiary"
          onPress={() => {
            haptics.tap();
            void Linking.openURL(directionsUrl(station.geo!));
          }}
        >
          <CornerUpRight size={16} color={foregroundColor} />
          <Button.Label>Directions</Button.Label>
        </Button>
      ) : null}
      {/* The website only has pages for train stations. */}
      {isRail ? (
        <Button className="flex-1" size="sm" variant="tertiary" onPress={share}>
          <ShareIcon size={16} color={foregroundColor} />
          <Button.Label>Share</Button.Label>
        </Button>
      ) : null}
    </View>
  );
});

const BoardTabs = memo(function BoardTabs({
  type,
  arrivalsSupported,
  onChange,
}: {
  type: BoardType;
  arrivalsSupported: boolean;
  onChange: (type: BoardType) => void;
}) {
  const [foregroundColor, mutedColor] = useThemeColor(["foreground", "muted"]);
  const tabs = [
    { value: "departures", label: "Departures", icon: ArrowUpRight, isDisabled: false },
    { value: "arrivals", label: "Arrivals", icon: ArrowDownLeft, isDisabled: !arrivalsSupported },
  ] as const;

  return (
    <Tabs value={type} onValueChange={(value) => onChange(value as BoardType)} variant="primary">
      <Tabs.List className="w-full">
        <Tabs.Indicator />
        {tabs.map(({ value, label, icon: Icon, isDisabled }) => (
          <Tabs.Trigger
            key={value}
            value={value}
            isDisabled={isDisabled}
            className="flex-1 gap-1.5"
          >
            {({ isSelected }) => (
              <>
                <Icon size={16} color={isSelected ? foregroundColor : mutedColor} />
                <Tabs.Label>{label}</Tabs.Label>
              </>
            )}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs>
  );
});

/** The station's notice from the live board: one line until it's pressed. */
function StationInfo({ info }: { info: string }) {
  const [foregroundColor, mutedColor] = useThemeColor(["default-foreground", "muted"]);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}
      accessibilityHint={isExpanded ? "Shows less" : "Shows the whole notice"}
      className="mx-4 mb-2 flex-row items-start gap-2 rounded-2xl bg-default px-3 py-2.5"
      onPress={() => {
        haptics.selection();
        setIsExpanded((current) => !current);
      }}
    >
      <View style={styles.noticeIcon}>
        <Megaphone size={16} color={mutedColor} />
      </View>
      <Text className="flex-1 text-sm leading-5 text-muted" numberOfLines={isExpanded ? 0 : 1}>
        {info}
      </Text>
      <View style={[styles.noticeIcon, isExpanded && styles.chevronUp]}>
        <ChevronDown size={16} color={foregroundColor} />
      </View>
    </PressableFeedback>
  );
}

function Notice({
  icon,
  children,
  isWarning = false,
  className = "",
}: {
  icon: ReactNode;
  children: ReactNode;
  isWarning?: boolean;
  className?: string;
}) {
  return (
    <View
      className={`mx-4 flex-row items-start gap-2 rounded-2xl px-3 py-2.5 ${isWarning ? "bg-warning-soft" : "bg-default"} ${className}`}
    >
      <View style={styles.noticeIcon}>{icon}</View>
      <Text
        className={`flex-1 text-sm leading-5 ${isWarning ? "text-warning-soft-foreground" : "text-muted"}`}
      >
        {children}
      </Text>
    </View>
  );
}

/** Above a board that couldn't be refreshed, whose trains are the last ones received. */
function StaleBoardNotice({ isOnline, onRetry }: { isOnline: boolean; onRetry: () => void }) {
  const [foregroundColor, mutedColor] = useThemeColor(["default-foreground", "muted"]);

  // Offline, the board refreshes by itself once the connection is back.
  if (!isOnline) {
    return (
      <Notice icon={<CloudOff size={16} color={mutedColor} />} className="mb-2">
        You're offline. Showing the last received data.
      </Notice>
    );
  }
  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityHint="Loads the live trains again"
      className="mx-4 mb-2 flex-row items-start gap-2 rounded-2xl bg-default px-3 py-2.5"
      onPress={onRetry}
    >
      <View style={styles.noticeIcon}>
        <CircleAlert size={16} color={mutedColor} />
      </View>
      <Text className="flex-1 text-sm leading-5 text-muted">
        Live updates are unavailable. Showing the last received data.
      </Text>
      <View style={styles.noticeIcon}>
        <RefreshCw size={16} color={foregroundColor} />
      </View>
    </PressableFeedback>
  );
}

interface LiveBoardProps {
  board: ReturnType<typeof useStationBoard>;
  type: BoardType;
  warning: string | null;
  /** Where the first train (or what's shown in its place) ends: the sheet peeks down to it. */
  onFirstItemLayout: (event: LayoutChangeEvent) => void;
}

const LiveBoard = memo(function LiveBoard({
  board,
  type,
  warning,
  onFirstItemLayout,
}: LiveBoardProps) {
  const [foregroundColor, warningColor] = useThemeColor(["default-foreground", "warning"]);
  const [showAll, setShowAll] = useState(false);
  const [expandedTrain, setExpandedTrain] = useState<string | null>(null);
  const { data, error, isOnline, retry } = board;

  // One train's info at a time, so the board stays compact.
  const toggleTrain = useCallback(
    (key: string) => setExpandedTrain((current) => (current === key ? null : key)),
    [],
  );

  if (!data) {
    if (error) {
      // Offline, the board reloads by itself once the connection is back.
      return isOnline ? (
        <StatusMessage
          icon={CircleAlert}
          title="Unable to load live trains"
          description={error.message ?? "Check your connection and try again."}
          onRetry={retry}
          onLayout={onFirstItemLayout}
        />
      ) : (
        <StatusMessage
          icon={CloudOff}
          title="You're offline"
          description="Live trains will load once you're back online."
          onLayout={onFirstItemLayout}
        />
      );
    }
    return (
      <View>
        <TrainRowSkeleton onLayout={onFirstItemLayout} />
        <TrainRowSeparator />
        <TrainRowSkeleton />
        <TrainRowSeparator />
        <TrainRowSkeleton />
      </View>
    );
  }

  const trains = showAll ? data.trains : data.trains.slice(0, collapsedTrainCount);
  const hiddenCount = data.trains.length - collapsedTrainCount;
  const keyCounts = new Map<string, number>();

  return (
    <View>
      {data.info ? <StationInfo info={data.info} /> : null}
      {error ? <StaleBoardNotice isOnline={isOnline} onRetry={retry} /> : null}
      {trains.length === 0 ? (
        <Text className="px-4 py-8 text-center text-sm text-muted" onLayout={onFirstItemLayout}>
          {error ? `No ${type} were listed in the last received update.` : `No ${type} scheduled`}
        </Text>
      ) : (
        trains.map((train, index) => {
          // Keyed by the train, not its position, so a refresh where trains have left keeps
          // the other rows mounted instead of re-creating the whole board.
          const key = trainKey(train);
          const occurrence = keyCounts.get(key) ?? 0;
          keyCounts.set(key, occurrence + 1);
          return (
            <Fragment key={occurrence ? `${key}-${occurrence}` : key}>
              {index > 0 ? <TrainRowSeparator /> : null}
              <TrainRow
                train={train}
                type={type}
                isExpanded={expandedTrain === key}
                onToggle={toggleTrain}
                onLayout={index === 0 ? onFirstItemLayout : undefined}
              />
            </Fragment>
          );
        })
      )}
      {hiddenCount > 0 ? (
        <Button
          className="mx-4 mt-3"
          size="sm"
          variant="tertiary"
          onPress={() => {
            haptics.tap();
            setShowAll((current) => !current);
          }}
        >
          <Button.Label>
            {showAll ? "Show fewer" : `Show all ${data.trains.length} ${type}`}
          </Button.Label>
          <View style={showAll ? styles.chevronUp : undefined}>
            <ChevronDown size={16} color={foregroundColor} />
          </View>
        </Button>
      ) : null}
      {warning ? (
        <Notice className="mt-3" isWarning icon={<TriangleAlert size={16} color={warningColor} />}>
          {warning}
        </Notice>
      ) : null}
    </View>
  );
});

// Wide enough to cover most of a chip's padding, so a cut-off chip clearly goes on.
const edgeFadeWidth = 28;

/** Fades the nearby chips out at an edge they continue past. */
function EdgeFade({ side, isVisible }: { side: "left" | "right"; isVisible: boolean }) {
  const color = useThemeColor("surface");
  return (
    <View
      pointerEvents="none"
      style={[
        styles.edgeFade,
        side === "left" ? styles.edgeFadeLeft : styles.edgeFadeRight,
        { opacity: isVisible ? 1 : 0 },
      ]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <SvgLinearGradient
            id={`fade-${side}`}
            x1={side === "left" ? 1 : 0}
            y1="0"
            x2={side === "left" ? 0 : 1}
            y2="0"
          >
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="1" stopColor={color} />
          </SvgLinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#fade-${side})`} />
      </Svg>
    </View>
  );
}

/**
 * The closest train stations, from the nearby button, to switch between their boards. They stay in
 * the same order while switching, and location updates don't reorder them. The button's icon leads
 * the row, and its edges fade where there are more stations to scroll to.
 */
function NearbySwitcher({
  stations,
  selectedId,
  onSelect,
}: {
  stations: NearbyStation[];
  selectedId: string;
  onSelect: (station: Station) => void;
}) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const canScrollLeft = scrollX > 1;
  const canScrollRight = scrollX + viewportWidth < contentWidth - 1;

  return (
    <View className="mt-3 flex-row items-center">
      <View className="me-2.5" importantForAccessibility="no" accessibilityElementsHidden>
        <NearbyIcon size={22} />
      </View>
      {/* Out to the sheet's edge, so the chips scroll under it instead of stopping short. */}
      <View className="-me-4 flex-1">
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="tablist"
          accessibilityLabel="Nearest train stations"
          contentContainerStyle={styles.nearbyChips}
          scrollEventThrottle={16}
          onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
          onContentSizeChange={(width) => setContentWidth(width)}
          onScroll={(event) => {
            const x = event.nativeEvent.contentOffset.x;
            // Only the fades depend on it, so it's only kept when one of them changes.
            setScrollX((current) =>
              current > 1 === x > 1 &&
              current + viewportWidth < contentWidth - 1 === x + viewportWidth < contentWidth - 1
                ? current
                : x,
            );
          }}
        >
          {stations.map((station) => {
            const isSelected = station.id === selectedId;
            return (
              <PressableFeedback
                key={station.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${station.name}, ${formatDistance(station.distance)} away`}
                className={`h-9 flex-row items-center gap-1.5 rounded-full px-3.5 ${isSelected ? "bg-accent-soft" : "bg-default"}`}
                // The sheet opens again for each station, so a station further along is scrolled
                // to, with some of the one before it still showing.
                onLayout={
                  isSelected
                    ? (event: LayoutChangeEvent) => {
                        const x = Math.max(0, event.nativeEvent.layout.x - edgeFadeWidth * 2);
                        scrollRef.current?.scrollTo({ x, animated: false });
                        setScrollX(x);
                      }
                    : undefined
                }
                onPress={() => {
                  if (!isSelected) onSelect(station);
                }}
              >
                <Text
                  className={`text-sm font-medium ${isSelected ? "text-accent-soft-foreground" : "text-default-foreground"}`}
                  numberOfLines={1}
                >
                  {station.name}
                </Text>
                <Text
                  className={`text-sm ${isSelected ? "text-accent-soft-foreground opacity-70" : "text-muted"}`}
                  style={styles.tabularNums}
                >
                  {formatDistance(station.distance)}
                </Text>
              </PressableFeedback>
            );
          })}
        </ScrollView>
        <EdgeFade side="left" isVisible={canScrollLeft} />
        <EdgeFade side="right" isVisible={canScrollRight} />
      </View>
    </View>
  );
}

interface StationSheetContentProps {
  station: Station;
  isOpen: boolean;
  stationsUrl: string | null;
  userLocation: UserLocation | null;
  /** The details below the live board, left out until the sheet has opened. */
  showDetails: boolean;
  onClose: () => void;
  onSelectStation: (station: Station) => void;
  /** The closest train stations, when the sheet was opened from the nearby button. */
  nearbyStations: NearbyStation[];
  onSelectNearbyStation: (station: Station) => void;
  onPeekHeightChange: (height: number) => void;
  onContentHeightChange: (height: number) => void;
}

function StationSheetContent({
  station,
  isOpen,
  stationsUrl,
  userLocation,
  showDetails,
  onClose,
  onSelectStation,
  nearbyStations,
  onSelectNearbyStation,
  onPeekHeightChange,
  onContentHeightChange,
}: StationSheetContentProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = useSheetBottomInset();
  const [type, setType] = useState<BoardType>("departures");
  const isRail = station.type === "rail";
  const arrivalsSupported = getCountry(station.id) !== "lu";
  const board = useStationBoard(station.id, type, isOpen && isRail);

  // The sheet peeks down to the end of the first train, below the header. The train is measured
  // once the board has loaded, and then kept, so refreshes and tab switches don't move the sheet.
  // Other stations have no board, so they peek down to the header.
  const [headerHeight, setHeaderHeight] = useState(0);
  const [firstItemBottom, setFirstItemBottom] = useState(0);
  const isPeekFinal = useRef(false);
  const [scrollRef, scrollOffset] = useSheetScrollOffset();
  const hasBoard = board.data !== null || board.error !== null;

  useEffect(() => {
    if (!headerHeight || (isRail && !firstItemBottom)) return;
    const boardHeight = isRail ? firstItemBottom : 0;
    onPeekHeightChange(handleHeight + headerHeight + boardHeight + Math.max(insets.bottom, 12));
  }, [isRail, headerHeight, firstItemBottom, insets.bottom, onPeekHeightChange]);

  // A stable callback, so the memoized board skips the sheet's other re-renders.
  const onFirstItemLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (isPeekFinal.current) return;
      const { y, height } = event.nativeEvent.layout;
      setFirstItemBottom((current) =>
        Math.abs(current - (y + height)) < 1 ? current : y + height,
      );
      if (hasBoard) isPeekFinal.current = true;
    },
    [hasBoard],
  );

  const selectType = useCallback(
    (next: BoardType) => {
      if (next === type) return;
      haptics.selection();
      setType(next);
    },
    [type],
  );

  return (
    <View style={styles.fill}>
      <PinnedSheetHeader onHeightChange={setHeaderHeight}>
        <View className="px-4">
          <SheetHeader
            title={station.name}
            titleLines={2}
            closeLabel="Close station"
            onClose={onClose}
          >
            <StationSubtitle
              station={station}
              timestamp={board.data?.timestamp}
              hasError={board.error !== null}
              isOnline={board.isOnline}
              isOpen={isOpen}
              userLocation={userLocation}
            />
          </SheetHeader>
          {nearbyStations.length > 1 ? (
            <NearbySwitcher
              stations={nearbyStations}
              selectedId={station.id}
              onSelect={onSelectNearbyStation}
            />
          ) : null}
          <QuickActions station={station} />
          {isRail ? (
            <View className="pt-3">
              <BoardTabs type={type} arrivalsSupported={arrivalsSupported} onChange={selectType} />
            </View>
          ) : null}
        </View>
        <SheetHeaderFade scrollOffset={scrollOffset} />
      </PinnedSheetHeader>
      <BottomSheetScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: bottomInset }}
        scrollIndicatorInsets={{ top: headerHeight }}
        onContentSizeChange={(_, height) => onContentHeightChange(height)}
      >
        {isRail ? (
          <View style={{ paddingTop: boardTopSpacing }}>
            <LiveBoard
              key={type}
              board={board}
              type={type}
              warning={getStationWarning(station.id)}
              onFirstItemLayout={onFirstItemLayout}
            />
          </View>
        ) : null}
        {showDetails ? (
          <StationDetails
            station={station}
            isOpen={isOpen}
            stationsUrl={stationsUrl}
            onSelectStation={onSelectStation}
          />
        ) : null}
      </BottomSheetScrollView>
    </View>
  );
}

/** Shown in the sheet if the station fails to render, so the map stays usable. */
function StationError({
  station,
  onRetry,
  onClose,
}: {
  station: Station;
  onRetry: () => void;
  onClose: () => void;
}) {
  const bottomInset = useSheetBottomInset();

  return (
    <BottomSheetView className="gap-2 px-4" style={{ paddingBottom: bottomInset }}>
      <SheetHeader
        title={station.name}
        titleLines={2}
        closeLabel="Close station"
        onClose={onClose}
      />
      <StatusMessage
        icon={CircleAlert}
        title="Something went wrong"
        description="This station couldn't be shown."
        onRetry={onRetry}
      />
    </BottomSheetView>
  );
}

interface StationSheetProps {
  station: Station;
  isOpen: boolean;
  /** The station GeoJSON the map shows, where nearby stations are found. */
  stationsUrl: string | null;
  userLocation: UserLocation | null;
  onOpenChange: (isOpen: boolean) => void;
  onSelectStation: (station: Station) => void;
  nearbyStations: NearbyStation[];
  onSelectNearbyStation: (station: Station) => void;
  /** Where the sheet is, for the map controls that sit above it. */
  position: SheetPosition;
}

export function StationSheet({
  station,
  isOpen,
  stationsUrl,
  userLocation,
  onOpenChange,
  onSelectStation,
  nearbyStations,
  onSelectNearbyStation,
  position,
}: StationSheetProps) {
  const topInset = useSheetTopInset();
  const { height: screenHeight } = useWindowDimensions();
  const sheetRef = useRef<BottomSheet>(null);
  const [index, setIndex] = useState(-1);
  const [peekHeight, setPeekHeight] = useState(defaultStationPeekHeight);
  const [contentHeight, setContentHeight] = useState(0);
  // The sheet opens as tall as its content, up to the top of the screen. The step in between is
  // only there when the content goes well past it.
  const hasMiddleStep =
    contentHeight === 0 ||
    handleHeight + contentHeight > (screenHeight - topInset) * middleStep + minStepGap;
  const [surfaceColor, mutedColor] = useThemeColor(["surface", "muted"]);

  // The sheet mounts open, since calls made before it has measured itself are dropped.
  const [initialIndex] = useState(isOpen ? 0 : -1);
  const isMounted = useRef(false);

  // Opens small on every station, including when picking another one from the open sheet.
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    if (isOpen) sheetRef.current?.snapToIndex(0);
    else sheetRef.current?.close();
  }, [isOpen, station.id]);

  // Android back shrinks the sheet back to its peek, then closes it.
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
      snapPoints={hasMiddleStep ? [peekHeight, `${middleStep * 100}%`] : [peekHeight]}
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
        // Entering the nearby flow also resets a previously open arrivals tab to departures.
        key={`${station.id}:${nearbyStations.length > 0 ? "nearby" : "station"}`}
        fallback={(reset) => (
          <StationError station={station} onRetry={reset} onClose={() => onOpenChange(false)} />
        )}
      >
        <StationSheetContent
          station={station}
          isOpen={isOpen}
          stationsUrl={stationsUrl}
          userLocation={userLocation}
          showDetails={index >= 0}
          onClose={() => onOpenChange(false)}
          onSelectStation={onSelectStation}
          nearbyStations={nearbyStations}
          onSelectNearbyStation={onSelectNearbyStation}
          onPeekHeightChange={setPeekHeight}
          onContentHeightChange={setContentHeight}
        />
      </ErrorBoundary>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  nearbyChips: { gap: 8, paddingRight: 16 },
  edgeFade: { position: "absolute", top: 0, bottom: 0, width: edgeFadeWidth },
  edgeFadeLeft: { left: 0 },
  edgeFadeRight: { right: 0 },
  fill: { flex: 1 },
  noticeIcon: { marginTop: 2 },
  chevronUp: { transform: [{ rotate: "180deg" }] },
  tabularNums: { fontVariant: ["tabular-nums"] },
});
