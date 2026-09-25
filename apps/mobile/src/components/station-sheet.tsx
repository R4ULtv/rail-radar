import { getCountry } from "@repo/data/countries";
import type { Station } from "@repo/data/types";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Button } from "heroui-native/button";
import { CloseButton } from "heroui-native/close-button";
import { useThemeColor } from "heroui-native/hooks";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { Tabs } from "heroui-native/tabs";
import ArrowDownLeft from "lucide-react-native/icons/arrow-down-left";
import ArrowUpRight from "lucide-react-native/icons/arrow-up-right";
import Bookmark from "lucide-react-native/icons/bookmark";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import CornerUpRight from "lucide-react-native/icons/corner-up-right";
import Megaphone from "lucide-react-native/icons/megaphone";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import Share from "lucide-react-native/icons/share";
import Share2 from "lucide-react-native/icons/share-2";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import { memo, useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import {
  BackHandler,
  Linking,
  Platform,
  Share as NativeShare,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CountryFlag } from "@/components/country-flag";
import { ErrorBoundary } from "@/components/error-boundary";
import { StationDetails } from "@/components/station-details";
import { TrainRow, TrainRowSkeleton, trainKey } from "@/components/train-row";
import { useStationBoard, type BoardType } from "@/hooks/use-station-board";
import { MAX_SAVED_STATIONS, useSavedStations } from "@/hooks/use-stored-stations";
import { distanceKm, formatDistance } from "@/lib/distance";
import { haptics } from "@/lib/haptics";
import { getStationWarning } from "@/lib/station-warnings";
import type { UserLocation } from "@/lib/user-location";

const handleHeight = 24;
// Before the sheet has measured itself: the header, the tabs and one train.
const defaultStationPeekHeight = 300;
// The last snap point, where the sheet covers the map.
const expandedIndex = 2;
// Long boards are cut short so the station details below them stay in reach.
const collapsedTrainCount = 10;
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

/** "Updated 12s ago", ticking every second. */
function useUpdatedLabel(timestamp: string | undefined, hasError: boolean, isOnline: boolean) {
  const [, tick] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    if (!timestamp) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

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
  userLocation: UserLocation | null;
}

// Its own component, so the label's every-second tick only re-renders this line.
function StationSubtitle({
  station,
  timestamp,
  hasError,
  isOnline,
  userLocation,
}: StationSubtitleProps) {
  const updatedLabel = useUpdatedLabel(timestamp, hasError, isOnline);
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
  const { isSaved, isFull, toggleSaved } = useSavedStations();
  const saved = isSaved(station.id);
  const ShareIcon = Platform.OS === "ios" ? Share : Share2;

  function toggleSavedStation() {
    if (saved) haptics.toggleOff();
    else haptics.toggleOn();
    toggleSaved(station);
  }

  function share() {
    haptics.tap();
    const url = `https://www.railradar24.com/station/${encodeURIComponent(station.id)}`;
    // iOS shares the link on its own; Android only shares the message.
    void NativeShare.share(
      Platform.OS === "ios"
        ? { url, message: `${station.name} on Rail Radar` }
        : { message: `${station.name} on Rail Radar\n${url}`, title: station.name },
    ).catch(() => {});
  }

  return (
    <View className="mt-3 flex-row gap-2">
      <Button
        accessibilityLabel={
          saved
            ? "Remove from saved stations"
            : isFull
              ? `Maximum ${MAX_SAVED_STATIONS} saved stations reached`
              : "Save station"
        }
        accessibilityState={{ selected: saved }}
        className="flex-1"
        isDisabled={!station.geo || (!saved && isFull)}
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
      <Button className="flex-1" size="sm" variant="tertiary" onPress={share}>
        <ShareIcon size={16} color={foregroundColor} />
        <Button.Label>Share</Button.Label>
      </Button>
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
        <Megaphone size={15} color={mutedColor} />
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

  // Offline, the board reloads by itself once the connection is back.
  const retryButton = isOnline ? (
    <Button className="self-start" size="sm" variant="tertiary" onPress={retry}>
      <RefreshCw size={15} color={foregroundColor} />
      <Button.Label>Retry</Button.Label>
    </Button>
  ) : null;

  if (!data) {
    if (error) {
      return (
        <View className="gap-3 px-4 py-4" onLayout={onFirstItemLayout}>
          <View className="gap-0.5">
            <Text className="text-sm font-medium text-foreground">
              {isOnline ? "Unable to load live trains" : "You're offline"}
            </Text>
            <Text className="text-sm text-muted">
              {isOnline
                ? (error.message ?? "Check your connection and try again.")
                : "Live trains will load once you're back online."}
            </Text>
          </View>
          {retryButton}
        </View>
      );
    }
    return (
      <View>
        <TrainRowSkeleton onLayout={onFirstItemLayout} />
        <TrainRowSkeleton />
        <TrainRowSkeleton />
      </View>
    );
  }

  const trains = showAll ? data.trains : data.trains.slice(0, collapsedTrainCount);
  const hiddenCount = data.trains.length - collapsedTrainCount;

  return (
    <View>
      {data.info ? <StationInfo info={data.info} /> : null}
      {error ? (
        <View className="mb-2 gap-2 px-4">
          <Text className="text-sm text-muted">
            {isOnline
              ? "Live updates are unavailable. Showing the last received data."
              : "You're offline. Showing the last received data."}
          </Text>
          {retryButton}
        </View>
      ) : null}
      {trains.length === 0 ? (
        <Text className="px-4 py-8 text-center text-sm text-muted" onLayout={onFirstItemLayout}>
          {error ? `No ${type} were listed in the last received update.` : `No ${type} scheduled`}
        </Text>
      ) : (
        trains.map((train, index) => (
          <TrainRow
            key={`${train.trainNumber}-${train.scheduledTime}-${train.platform ?? ""}-${index}`}
            train={train}
            type={type}
            isExpanded={expandedTrain === trainKey(train)}
            onToggle={toggleTrain}
            onLayout={index === 0 ? onFirstItemLayout : undefined}
          />
        ))
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
        <Notice className="mt-3" isWarning icon={<TriangleAlert size={15} color={warningColor} />}>
          {warning}
        </Notice>
      ) : null}
    </View>
  );
});

interface StationSheetContentProps {
  station: Station;
  isOpen: boolean;
  stationsUrl: string | null;
  userLocation: UserLocation | null;
  /** The details below the live board, left out until the sheet has opened. */
  showDetails: boolean;
  onClose: () => void;
  onSelectStation: (station: Station) => void;
  onPeekHeightChange: (height: number) => void;
}

function StationSheetContent({
  station,
  isOpen,
  stationsUrl,
  userLocation,
  showDetails,
  onClose,
  onSelectStation,
  onPeekHeightChange,
}: StationSheetContentProps) {
  const insets = useSafeAreaInsets();
  const [type, setType] = useState<BoardType>("departures");
  const isRail = station.type === "rail";
  const arrivalsSupported = getCountry(station.id) !== "lu";
  const board = useStationBoard(station.id, type, isOpen && isRail);

  // The sheet peeks down to the end of the first train. It's measured once the board has
  // loaded, and then kept, so refreshes and tab switches don't move the sheet.
  const [layout, setLayout] = useState({ header: 0, boardTop: 0, firstItemBottom: 0 });
  const isPeekFinal = useRef(false);
  const hasBoard = useRef(false);
  hasBoard.current = !isRail || board.data !== null || board.error !== null;

  useEffect(() => {
    if (!layout.header || !layout.firstItemBottom) return;
    onPeekHeightChange(
      handleHeight +
        layout.header +
        layout.boardTop +
        layout.firstItemBottom +
        Math.max(insets.bottom, 12),
    );
  }, [layout, insets.bottom, onPeekHeightChange]);

  // Stable callbacks, so the memoized board and details skip the sheet's other re-renders.
  const measure = useCallback((key: keyof typeof layout, value: number) => {
    if (isPeekFinal.current) return;
    setLayout((current) =>
      Math.abs(current[key] - value) < 1 ? current : { ...current, [key]: value },
    );
  }, []);

  const onFirstItemLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      measure("firstItemBottom", y + height);
      if (hasBoard.current) isPeekFinal.current = true;
    },
    [measure],
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
    <View style={styles.content}>
      <View
        className="px-4 pb-3"
        onLayout={(event) => measure("header", event.nativeEvent.layout.height)}
      >
        <View className="flex-row items-start gap-3">
          <View style={styles.title}>
            <Text className="text-xl font-semibold text-foreground" numberOfLines={2}>
              {station.name}
            </Text>
            <StationSubtitle
              station={station}
              timestamp={board.data?.timestamp}
              hasError={board.error !== null}
              isOnline={board.isOnline}
              userLocation={userLocation}
            />
          </View>
          <CloseButton accessibilityLabel="Close station" onPress={onClose} />
        </View>
        <QuickActions station={station} />
      </View>

      <BottomSheetScrollView
        stickyHeaderIndices={isRail ? [0] : undefined}
        // The same space below the report links as above them, clear of the home indicator.
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 32) }}
      >
        {isRail ? (
          <View className="bg-surface px-4 pb-3">
            <BoardTabs type={type} arrivalsSupported={arrivalsSupported} onChange={selectType} />
          </View>
        ) : null}
        <View onLayout={(event) => measure("boardTop", event.nativeEvent.layout.y)}>
          {isRail ? (
            <LiveBoard
              key={type}
              board={board}
              type={type}
              warning={getStationWarning(station.id)}
              onFirstItemLayout={onFirstItemLayout}
            />
          ) : (
            <Text className="px-4 pb-2 text-sm text-muted" onLayout={onFirstItemLayout}>
              Live trains are shown for train stations only.
            </Text>
          )}
        </View>
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
function StationError({ onRetry, onClose }: { onRetry: () => void; onClose: () => void }) {
  const foregroundColor = useThemeColor("default-foreground");

  return (
    <View className="gap-3 px-4 pb-4">
      <View className="flex-row items-start gap-3">
        <View style={styles.title}>
          <Text className="text-xl font-semibold text-foreground">Something went wrong</Text>
          <Text className="mt-1 text-sm text-muted">This station couldn't be shown.</Text>
        </View>
        <CloseButton accessibilityLabel="Close station" onPress={onClose} />
      </View>
      <Button className="self-start" size="sm" variant="tertiary" onPress={onRetry}>
        <RefreshCw size={15} color={foregroundColor} />
        <Button.Label>Try again</Button.Label>
      </Button>
    </View>
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
  /** Whether the sheet is fully open, so the map can ignore gestures in the strip above it. */
  onExpandedChange: (isExpanded: boolean) => void;
}

export function StationSheet({
  station,
  isOpen,
  stationsUrl,
  userLocation,
  onOpenChange,
  onSelectStation,
  onExpandedChange,
}: StationSheetProps) {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const [index, setIndex] = useState(-1);
  const [peekHeight, setPeekHeight] = useState(defaultStationPeekHeight);
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
      snapPoints={[peekHeight, "60%", "100%"]}
      topInset={insets.top + 8}
      enableDynamicSizing={false}
      enableOverDrag={false}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: surfaceColor, borderRadius: 24 }}
      handleIndicatorStyle={{ backgroundColor: mutedColor }}
      onChange={(next) => {
        setIndex(next);
        onExpandedChange(next === expandedIndex);
        if (next === -1 && isOpen) onOpenChange(false);
      }}
    >
      <ErrorBoundary
        key={station.id}
        fallback={(reset) => <StationError onRetry={reset} onClose={() => onOpenChange(false)} />}
      >
        <StationSheetContent
          station={station}
          isOpen={isOpen}
          stationsUrl={stationsUrl}
          userLocation={userLocation}
          // Below the peek, and slow to render with the nearby stations, so they're added once
          // the sheet has opened rather than delaying it.
          showDetails={index >= 0}
          onClose={() => onOpenChange(false)}
          onSelectStation={onSelectStation}
          onPeekHeightChange={setPeekHeight}
        />
      </ErrorBoundary>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  title: { flex: 1, minWidth: 0 },
  noticeIcon: { marginTop: 2 },
  chevronUp: { transform: [{ rotate: "180deg" }] },
  tabularNums: { fontVariant: ["tabular-nums"] },
});
