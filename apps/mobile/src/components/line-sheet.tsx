import { getStationLines } from "@repo/data/lines";
import type { Station } from "@repo/data/types";
import BottomSheet, {
  BottomSheetFlatList,
  BottomSheetView,
  useBottomSheet,
  useBottomSheetInternal,
  SCROLLABLE_STATUS,
  type BottomSheetFlatListMethods,
} from "@gorhom/bottom-sheet";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import { ListGroup } from "heroui-native/list-group";
import { Separator } from "heroui-native/separator";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import Bookmark from "lucide-react-native/icons/bookmark";
import Check from "lucide-react-native/icons/check";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import ChevronsUpDown from "lucide-react-native/icons/chevrons-up-down";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import Info from "lucide-react-native/icons/info";
import RotateCcw from "lucide-react-native/icons/rotate-ccw";
import RotateCw from "lucide-react-native/icons/rotate-cw";
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

import { useUniwind } from "uniwind";
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle } from "react-native-reanimated";

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
import { ReportLinks } from "@/components/station-details";
import { RowSeparator, SectionTitle } from "@/components/station-list";
import { middleStep } from "@/components/station-sheet";
import { StatusMessage } from "@/components/status-message";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import { useSavedLines } from "@/hooks/use-saved-lines";
import { useStationsById } from "@/hooks/use-stations-by-id";
import { haptics } from "@/lib/haptics";
import type { DiagramStop } from "@/lib/line-diagram";
import {
  collapseStops,
  getDirectionOptions,
  getDirectionTo,
  getTravelStops,
  isSameDirection,
  type DirectionOption,
} from "@/lib/line-directions";
import {
  formatServiceDays,
  formatServiceFrequency,
  formatServiceHours,
  formatServiceStatus,
  getServiceStatus,
  getTodaysPeriod,
} from "@/lib/line-service";
import {
  getKnownRoutes,
  getLineBadgeCode,
  getLineColor,
  getLineColorOnCard,
  getLineColorOnSheet,
  getLineCountry,
  getLineOperatorName,
  getLineIconColor,
  getViaStation,
  lineTypeLabels,
  shortStationName,
  type Line,
  type LineDirection,
} from "@/lib/lines";
import { lineUrl } from "@/lib/links";
import { stationIcons } from "@/lib/station-icons";

const handleHeight = 24;
// How much further the content has to go for the middle step to be worth a stop.
const minStepGap = 80;
const skeletonStopCount = 6;

function LineSubtitle({ line }: { line: Line }) {
  const subtitle = [lineTypeLabels[line.type], getLineOperatorName(line)]
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

/**
 * Whether the line runs now on its own clock, as a pill under the title: "Running every 2–8 min ·
 * until 00:37". The week's hours are in About at the bottom of the sheet.
 */
function LiveService({ line }: { line: Line }) {
  const now = useMinuteClock();
  const country = getLineCountry(line);
  if (!line.service?.length || !country) return null;
  const status = getServiceStatus(line.service, country, now);
  const { label, detail } = formatServiceStatus(status);

  return (
    <View
      className={`mt-3 flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5 ${status.running ? "bg-success-soft" : "bg-default"}`}
      accessible
      accessibilityLabel={detail ? `${label}, ${detail.replaceAll(" · ", ", ")}` : label}
    >
      <View
        className={
          status.running ? "size-1.5 rounded-full bg-success" : "size-1.5 rounded-full bg-muted"
        }
      />
      <Text className="shrink text-[13px] text-foreground" numberOfLines={1}>
        <Text
          className={
            status.running ? "font-semibold text-success" : "font-semibold text-foreground"
          }
        >
          {label}
        </Text>
        {detail ? `  ${detail}` : null}
      </Text>
    </View>
  );
}

/** Small buttons next to the close button, to save or share the line. */
const HeaderActions = memo(function HeaderActions({ line }: { line: Line }) {
  const [mutedColor, accentColor] = useThemeColor(["muted", "accent"]);
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
    <>
      <Button
        accessibilityLabel={saved ? "Remove from saved lines" : "Save line"}
        accessibilityState={{ selected: saved }}
        size="sm"
        variant="tertiary"
        isIconOnly
        hitSlop={6}
        onPress={toggleSaved}
      >
        <Bookmark
          size={18}
          color={saved ? accentColor : mutedColor}
          fill={saved ? accentColor : "none"}
        />
      </Button>
      <Button
        accessibilityLabel="Share line"
        size="sm"
        variant="tertiary"
        isIconOnly
        hitSlop={6}
        onPress={share}
      >
        <ShareIcon size={18} color={mutedColor} />
      </Button>
    </>
  );
});

/** A line color at low opacity, for the circles of the ways not chosen. */
function tint(color: string) {
  return /^#[\da-f]{6}$/i.test(color) ? `${color}24` : color;
}

/**
 * Which way a direction goes on the diagram above: an arrow to its side, or round for a loop.
 * Filled for the chosen one.
 */
function DirectionMark({
  color,
  option,
  filled,
}: {
  color: string;
  option: DirectionOption;
  filled: boolean;
}) {
  const theme = useUniwind().theme === "light" ? "light" : "dark";
  const markColor = filled ? getLineColorOnSheet(color, theme) : getLineColorOnCard(color, theme);
  const Icon = option.isLoop
    ? option.side === "left"
      ? RotateCcw
      : RotateCw
    : option.side === "left"
      ? ArrowLeft
      : ArrowRight;
  return (
    <View
      className="size-7 items-center justify-center rounded-full"
      importantForAccessibility="no"
      style={{ backgroundColor: filled ? markColor : tint(markColor) }}
    >
      <Icon size={15} strokeWidth={2.5} color={filled ? getLineIconColor(markColor) : markColor} />
    </View>
  );
}

function directionTitle(option: DirectionOption, nameOf: (id: string) => string) {
  if (option.isLoop) return option.side === "left" ? "Anticlockwise" : "Clockwise";
  return nameOf(option.destinationId);
}

/** "via Bank · next Euston · 21 stops", or where it starts for a line opened from elsewhere. */
function directionDetail(option: DirectionOption, nameOf: (id: string) => string) {
  return [
    option.via ? `via ${option.via}` : null,
    option.nextId
      ? `next ${nameOf(option.nextId)}`
      : option.isLoop
        ? null
        : `from ${nameOf(option.originId)}`,
    `${option.stopCount} ${option.stopCount === 1 ? "stop" : "stops"}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Where the stops below are headed, since that's what someone taking the line needs: the end the
 * chosen way goes to and its next stop. Closed, it shows that way; open, every way there is to go,
 * each with an arrow to its side of the diagram. Picking one closes it again.
 */
function GoingTowards({
  options,
  selected,
  color,
  nameOf,
  isOpen,
  onToggle,
  onChange,
}: {
  options: readonly DirectionOption[];
  selected: DirectionOption;
  color: string;
  nameOf: (id: string) => string;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (direction: LineDirection) => void;
}) {
  const mutedColor = useThemeColor("muted");
  const theme = useUniwind().theme === "light" ? "light" : "dark";
  const canChoose = options.length > 1;
  const title = directionTitle(selected, nameOf);
  const detail = directionDetail(selected, nameOf);

  return (
    <View className="mt-6">
      <View className="mb-1.5 flex-row items-center justify-between px-4">
        <Text className="text-xs font-medium text-muted">Going towards</Text>
        {isOpen ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done choosing a direction"
            hitSlop={8}
            className="active:opacity-60"
            onPress={() => {
              haptics.tap();
              onToggle();
            }}
          >
            <Text className="text-sm font-semibold text-foreground">Done</Text>
          </Pressable>
        ) : null}
      </View>
      {/* Clipped, so a pressed first or last row keeps the rounded corners. */}
      <ListGroup variant="secondary" className="overflow-hidden">
        {isOpen ? (
          <View accessibilityRole="radiogroup" className="py-1">
            {options.map((option, position) => {
              const isSelected = option.key === selected.key;
              const optionTitle = directionTitle(option, nameOf);
              const optionDetail = directionDetail(option, nameOf);
              return (
                <Fragment key={option.key}>
                  {position > 0 ? <RowSeparator /> : null}
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`${optionTitle}, ${optionDetail}`}
                    className="min-h-13 flex-row items-center gap-3 px-3.5 py-2 active:bg-surface-tertiary"
                    onPress={() => {
                      if (isSelected) {
                        haptics.tap();
                        onToggle();
                      } else {
                        haptics.selection();
                        onChange(option.direction);
                      }
                    }}
                  >
                    <DirectionMark color={color} option={option} filled={isSelected} />
                    <View className="flex-1">
                      <Text
                        className={`text-[17px] leading-[22px] text-foreground ${isSelected ? "font-semibold" : "font-medium"}`}
                        numberOfLines={1}
                      >
                        {optionTitle}
                      </Text>
                      <Text className="text-sm text-muted" numberOfLines={1}>
                        {optionDetail}
                      </Text>
                    </View>
                    <View className="w-5 items-center">
                      {isSelected ? (
                        <Check
                          size={20}
                          strokeWidth={2.5}
                          color={getLineColorOnCard(color, theme)}
                        />
                      ) : null}
                    </View>
                  </Pressable>
                </Fragment>
              );
            })}
          </View>
        ) : (
          <Pressable
            accessibilityRole={canChoose ? "button" : undefined}
            accessibilityLabel={`Going towards ${title}, ${detail}`}
            accessibilityHint={canChoose ? "Shows the other directions" : undefined}
            disabled={!canChoose}
            className="flex-row items-center gap-3 px-3.5 py-3 active:bg-surface-tertiary"
            onPress={() => {
              haptics.tap();
              onToggle();
            }}
          >
            <DirectionMark color={color} option={selected} filled />
            <View className="flex-1">
              <Text className="text-xl font-semibold text-foreground" numberOfLines={1}>
                {title}
              </Text>
              <Text className="text-sm text-muted" numberOfLines={1}>
                {detail}
              </Text>
            </View>
            {canChoose ? <ChevronDown size={18} color={mutedColor} /> : null}
          </Pressable>
        )}
      </ListGroup>
    </View>
  );
}

/** Three dots down the strip, where stops are left out. */
function StripDots({ color, style }: { color: string; style: object }) {
  return (
    <View style={[styles.stripDots, style]}>
      {[0, 1, 2].map((dot) => (
        <View key={dot} style={[styles.gapDot, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

/**
 * The strip in the line's color down the side of the stops, with each stop's ring on it: bigger
 * at the ends, and with a dot in it at the stop the line is shown from. It turns to dots next to
 * stops that are left out.
 */
function StopStrip({
  color,
  isFirst,
  isLast,
  dottedAbove = false,
  dottedBelow = false,
  dot,
}: {
  color: string;
  isFirst: boolean;
  isLast: boolean;
  dottedAbove?: boolean;
  dottedBelow?: boolean;
  dot: "small" | "big" | "focus";
}) {
  const surfaceColor = useThemeColor("surface");
  const above = { top: 0, bottom: "50%" } as const;
  const below = { top: "50%", bottom: 0 } as const;
  const hasGap = (!isFirst && dottedAbove) || (!isLast && dottedBelow);
  return (
    <View className="w-7 items-center justify-center" importantForAccessibility="no">
      {/* The dot covers the middle of a continuous strip. Only split it when a
          hidden-stop gap needs different decoration on either side. */}
      {hasGap ? (
        <>
          {isFirst ? null : dottedAbove ? (
            <StripDots color={color} style={above} />
          ) : (
            <View style={[styles.stripBar, above, { backgroundColor: color }]} />
          )}
          {isLast ? null : dottedBelow ? (
            <StripDots color={color} style={below} />
          ) : (
            <View style={[styles.stripBar, below, { backgroundColor: color }]} />
          )}
        </>
      ) : isFirst && isLast ? null : (
        <View
          style={[
            styles.stripBar,
            { top: isFirst ? "50%" : 0, bottom: isLast ? "50%" : 0, backgroundColor: color },
          ]}
        />
      )}
      <View
        style={[
          dot === "focus" ? styles.focusDot : dot === "small" ? styles.stopDot : styles.bigDot,
          { borderColor: color, backgroundColor: surfaceColor },
        ]}
      >
        {dot === "focus" ? <View style={[styles.focusCenter, { backgroundColor: color }]} /> : null}
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
  /** The last stop of a way that ends, not of a loop. */
  isEnd: boolean;
  /** Next to stops that are left out, so the strip turns to dots that side. */
  gapAbove: boolean;
  gapBelow: boolean;
}

/** Stops left out until the list is expanded. */
interface GapItem {
  type: "gap";
  key: string;
  /** Where the hidden stops start among all of the route's stops. */
  from: number;
  count: number;
}

/** The diagram and the directions, in the list so they scroll with the stops. */
interface IntroItem {
  type: "intro";
  key: string;
}

const introItem: IntroItem = { type: "intro", key: "intro" };

type ListItem = IntroItem | StopItem | GapItem;

/** The other lines at a stop. */
function StopLines({ station, line }: { station: Station; line: Line }) {
  const interchanges = getStationLines(station.id).filter((other) => other.id !== line.id);
  if (interchanges.length === 0) return null;
  return (
    <View className="shrink-0 flex-row items-center gap-1">
      {interchanges.map((other) => (
        <LineBadge key={other.id} line={other} size="sm" />
      ))}
    </View>
  );
}

const LineStop = memo(function LineStop({
  item,
  line,
  color,
  isHighlighted,
  rowHeight,
  onSelect,
}: {
  item: StopItem;
  line: Line;
  color: string;
  isHighlighted: boolean;
  rowHeight: number;
  onSelect: (station: Station) => void;
}) {
  const { station, isFirst, isLast, isEnd, gapAbove, gapBelow } = item;
  const isTerminus = isFirst || isLast;
  const isRail = station.type === "rail";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isHighlighted }}
      accessibilityHint={isHighlighted ? undefined : "Shows the line from this stop"}
      className="flex-row px-4 active:bg-surface-tertiary"
      style={{ height: rowHeight }}
      accessibilityLabel={`${shortStationName(station.name)}${isHighlighted ? ", shown from this stop" : ""}${isEnd ? ", end of line" : ""}${isRail ? ", train station" : ""}`}
      onPress={() => onSelect(station)}
    >
      <StopStrip
        color={color}
        isFirst={isFirst}
        isLast={isLast}
        dottedAbove={gapAbove}
        dottedBelow={gapBelow}
        dot={isHighlighted ? "focus" : isTerminus ? "big" : "small"}
      />
      <View className="ml-3 min-h-11 flex-1 flex-row items-center gap-2 py-1.5">
        {/* A train station's icon sits by its name, leaving the right for the other lines. */}
        <View className="flex-1 flex-row items-center gap-1.5">
          <Text
            className={`shrink text-base text-foreground ${isHighlighted || isEnd ? "font-semibold" : "font-medium"}`}
            numberOfLines={1}
          >
            {shortStationName(station.name)}
          </Text>
          {isRail ? (
            <Image
              accessible
              accessibilityLabel="Train station"
              source={stationIcons.rail}
              style={styles.railIcon}
            />
          ) : null}
        </View>
        {isEnd ? <Text className="text-xs font-semibold text-muted">End of line</Text> : null}
        <StopLines station={station} line={line} />
      </View>
    </Pressable>
  );
});

/** Dots down the strip where stops are left out; pressing them shows those stops. */
function HiddenStopsRow({
  count,
  color,
  onExpand,
  rowHeight,
}: {
  count: number;
  color: string;
  onExpand: () => void;
  rowHeight: number;
}) {
  const mutedColor = useThemeColor("muted");
  const label = `${count} more stops`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Show ${label}`}
      className="flex-row px-4 active:bg-surface-tertiary"
      onPress={onExpand}
      style={{ height: rowHeight }}
    >
      <View className="w-7" importantForAccessibility="no">
        <StripDots color={color} style={styles.fillStrip} />
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

/**
 * The description and the usual timetable, a row a period with today's picked out. Timetable
 * context adds information instead of repeating the header's operator and country.
 */
function LineAbout({ line }: { line: Line }) {
  const mutedColor = useThemeColor("muted");
  const now = useMinuteClock();
  const service = line.service ?? [];
  const country = getLineCountry(line);
  const today = country && service.length ? getTodaysPeriod(service, country, now) : undefined;
  return (
    <View className="px-4">
      {line.description || service.length > 0 ? (
        <View className="mt-6">
          <SectionTitle icon={<Info size={14} color={mutedColor} />}>About</SectionTitle>
          <ListGroup variant="secondary">
            {line.description ? (
              <Text className="px-4 py-3.5 text-[15px] leading-[22px] text-foreground">
                {line.description}
              </Text>
            ) : null}
            {service.length ? (
              <View className="px-4 pt-3 pb-2">
                {line.description ? <Separator className="-mt-3 mb-3" /> : null}
                <View className="flex-row items-center justify-between pb-1">
                  <Text className="text-xs text-muted">Usual service</Text>
                  <Text className="text-xs text-muted">Every</Text>
                </View>
                {service.map((period) => {
                  const isToday = period === today;
                  return (
                    <View
                      key={period.days}
                      accessible
                      accessibilityLabel={`${formatServiceDays(period.days)}${isToday ? ", today" : ""}: ${formatServiceHours(period)}, every ${formatServiceFrequency(period.every)}`}
                      className="min-h-8 flex-row items-center gap-3 py-1"
                    >
                      <Text
                        className={`w-22 text-sm ${isToday ? "font-semibold text-foreground" : "text-muted"}`}
                        numberOfLines={1}
                      >
                        {formatServiceDays(period.days)}
                      </Text>
                      <Text
                        className={`flex-1 text-sm text-foreground ${isToday ? "font-semibold" : ""}`}
                        numberOfLines={1}
                      >
                        {formatServiceHours(period)}
                      </Text>
                      <Text className={`text-sm text-foreground ${isToday ? "font-semibold" : ""}`}>
                        {formatServiceFrequency(period.every)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </ListGroup>
          {service.length ? (
            <Text className="mx-4 mt-2 text-xs leading-4 text-muted">
              Main section, in local time. Branches may run less often, and public holidays use
              Sunday's times.
            </Text>
          ) : null}
        </View>
      ) : null}
      <ReportLinks />
    </View>
  );
}

/** Which run of hidden stops was expanded, for the way it's in. */
function gapKey(direction: LineDirection, from: number) {
  return `${direction.route}${direction.reversed ? "<" : ">"}${from}`;
}

function itemKey(item: ListItem) {
  return item.key;
}

interface LineSheetContentProps {
  line: Line;
  stationsUrl: string | null;
  /** The stop the line is shown from, highlighted among the others. */
  fromStationId: string | null;
  /** Which way along the line the stops are listed. */
  direction: LineDirection;
  onDirectionChange: (direction: LineDirection) => void;
  onClose: () => void;
  /** A stop picked in the list, to show the line from, and the way to go from it. */
  onFocusStop: (station: Station, direction: LineDirection) => void;
  onContentHeightChange: (height: number) => void;
}

function LineSheetContent({
  line,
  stationsUrl,
  fromStationId,
  direction,
  onDirectionChange,
  onClose,
  onFocusStop,
  onContentHeightChange,
}: LineSheetContentProps) {
  const bottomInset = useSheetBottomInset();
  const stationsById = useStationsById(stationsUrl);
  const theme = useUniwind().theme === "light" ? "light" : "dark";
  const color = getLineColor(line);
  // The stops' strip, which a line as dark as the sheet would leave out.
  const trackColor = getLineColorOnSheet(color, theme);
  // Starts with the termini and the stops around the one the line is shown from. Each run of
  // dots expands on its own, so the stops around that one stay where they are.
  const [expandedGaps, setExpandedGaps] = useState<ReadonlySet<string>>(() => new Set());
  const [isDirectionsOpen, setIsDirectionsOpen] = useState(false);
  const { expand: expandSheet } = useBottomSheet();
  const { animatedScrollableStatus, animatedSheetHeight, animatedLayoutState } =
    useBottomSheetInternal();
  // On the sheet's first opening its content can come out taller than the sheet, which leaves the
  // end of the list below the screen, so it's held to the sheet's height without its handle.
  const fillStyle = useAnimatedStyle(() => {
    const sheetHeight = animatedSheetHeight.get();
    const { handleHeight: measuredHandle } = animatedLayoutState.get();
    return sheetHeight > 0 && measuredHandle > 0 ? { maxHeight: sheetHeight - measuredHandle } : {};
  });
  const [isExtended, setIsExtended] = useState(false);
  // Wait for the list itself to unlock. onChange can be stale after a drag, and the animated
  // index can report its destination early while dynamic content changes the detents.
  useAnimatedReaction(
    () => animatedScrollableStatus.get() === SCROLLABLE_STATUS.UNLOCKED,
    (extended, previous) => {
      if (extended !== previous) runOnJS(setIsExtended)(extended);
    },
  );
  const [headerHeight, setHeaderHeight] = useState(0);
  const [introHeight, setIntroHeight] = useState(0);
  const [scrollRef, scrollOffset] = useSheetScrollOffset<FlatList<ListItem>>();
  const { fontScale } = useWindowDimensions();
  // A single text line and its padding, even with large system text. Exact heights let the
  // virtual list jump to stops it hasn't rendered yet.
  const rowHeight = Math.max(44, Math.ceil(22 * fontScale) + 12);
  const [pendingStop, setPendingStop] = useState<DiagramStop | null>(null);
  const [pendingOffset, setPendingOffset] = useState<number | null>(null);
  const [diagramVisible, setDiagramVisible] = useState(true);
  useAnimatedReaction(
    () => scrollOffset.get() < 20,
    (visible, previous) => {
      if (visible !== previous) runOnJS(setDiagramVisible)(visible);
    },
  );
  const diagramStyle = useAnimatedStyle(() => ({
    // Fade before the first labels reach the pinned header (20 pt above the diagram).
    opacity: Math.max(0, 1 - Math.max(0, scrollOffset.get()) / 20),
  }));
  const routes = useMemo(
    () => (stationsById ? getKnownRoutes(line, stationsById) : null),
    [line, stationsById],
  );
  const nameOf = useCallback(
    (id: string) => {
      const station = stationsById?.get(id);
      return station ? shortStationName(station.name) : "";
    },
    [stationsById],
  );
  const options = useMemo(() => {
    if (!routes || !stationsById) return [];
    return getDirectionOptions(routes, fromStationId, direction, (ids) => {
      const via = getViaStation(ids, stationsById);
      return via ? shortStationName(via.name) : null;
    });
  }, [routes, stationsById, fromStationId, direction]);
  const selectedOption =
    options.find((option) => option.directions.some((one) => isSameDirection(one, direction))) ??
    options[0];

  const list = useMemo(() => {
    if (!routes || !stationsById) return null;
    const travel = getTravelStops(routes, direction);
    const last = travel.length - 1;
    const isLoop = last > 1 && travel[0] === travel[last];
    const toItem = (index: number): StopItem => ({
      type: "stop",
      // By where it is on the route as the diagram has it, so its dots find it. A loop comes back
      // to where it started.
      key: `${travel[index]}-${direction.reversed ? last - index : index}`,
      station: stationsById.get(travel[index]!)!,
      isFirst: index === 0,
      isLast: index === last,
      isEnd: index === last && last > 0 && !isLoop,
      gapAbove: false,
      gapBelow: false,
    });
    const focusIndex = fromStationId ? travel.indexOf(fromStationId) : -1;
    const entries = collapseStops(travel.length, focusIndex);
    const stops = entries.flatMap((entry): ListItem[] => {
      if (typeof entry === "number") return [toItem(entry)];
      if (expandedGaps.has(gapKey(direction, entry.from))) {
        return Array.from({ length: entry.count }, (_, offset) => toItem(entry.from + offset));
      }
      return [{ type: "gap", key: `gap-${entry.from}`, from: entry.from, count: entry.count }];
    });
    stops.forEach((item, position) => {
      if (item.type !== "stop") return;
      item.gapAbove = stops[position - 1]?.type === "gap";
      item.gapBelow = stops[position + 1]?.type === "gap";
    });
    return { stops, focusIndex };
  }, [routes, stationsById, direction, fromStationId, expandedGaps]);
  const stops = list?.stops ?? null;
  const items = useMemo((): ListItem[] => [introItem, ...(stops ?? [])], [stops]);

  // Reveal immediately, even when the sheet's last reported detent is stale. When adding
  // stops above the origin, compensate for their height so the origin stays in view.
  const expandGap = useCallback(
    (from: number) => {
      haptics.tap();
      setPendingStop(null);
      const gap = stops?.find((item) => item.type === "gap" && item.from === from);
      if (gap?.type === "gap" && list && from < list.focusIndex) {
        setPendingOffset(Math.max(0, scrollOffset.get()) + (gap.count - 1) * rowHeight);
      }
      setExpandedGaps((gaps) => new Set(gaps).add(gapKey(direction, from)));
      expandSheet();
    },
    [expandSheet, stops, list, direction, scrollOffset, rowHeight],
  );

  // A stop picked on the diagram is shown in the list, going towards it.
  const selectDiagramStop = useCallback(
    (stop: DiagramStop) => {
      if (!routes) return;
      haptics.selection();
      const next = getDirectionTo(
        routes,
        stop.routeIndex,
        stop.stopIndex,
        fromStationId,
        direction,
      );
      if (!isSameDirection(next, direction)) onDirectionChange(next);
      const travel = getTravelStops(routes, next);
      const index = next.reversed ? travel.length - 1 - stop.stopIndex : stop.stopIndex;
      const focus = fromStationId ? travel.indexOf(fromStationId) : -1;
      const gap = collapseStops(travel.length, focus).find(
        (entry) =>
          typeof entry !== "number" && index >= entry.from && index < entry.from + entry.count,
      );
      if (gap && typeof gap !== "number") {
        setExpandedGaps((expanded) => new Set(expanded).add(gapKey(next, gap.from)));
      }
      setIsDirectionsOpen(false);
      setPendingOffset(null);
      setPendingStop(stop);
      expandSheet();
    },
    [routes, direction, onDirectionChange, fromStationId, expandSheet],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<ListItem> | null | undefined, index: number) => ({
      index,
      length: index === 0 ? introHeight : rowHeight,
      offset: headerHeight + (index === 0 ? 0 : introHeight + (index - 1) * rowHeight),
    }),
    [headerHeight, introHeight, rowHeight],
  );

  useEffect(() => {
    if (
      !isExtended ||
      !pendingStop ||
      pendingStop.routeIndex !== direction.route ||
      introHeight === 0
    )
      return;
    const target = items.findIndex(
      (item) =>
        item.type === "stop" && item.key === `${pendingStop.stationId}-${pendingStop.stopIndex}`,
    );
    if (target < 0) return;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollToIndex({
        index: target,
        viewOffset: headerHeight + 48,
        animated: true,
      });
      setPendingStop(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [isExtended, pendingStop, items, direction.route, introHeight, headerHeight, scrollRef]);

  useEffect(() => {
    if (!isExtended || pendingOffset === null) return;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollToOffset({ offset: pendingOffset, animated: false });
      setPendingOffset(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [isExtended, pendingOffset, items, scrollRef]);

  // A stop picked in the list becomes the one the line is shown from, as if opened from it,
  // keeping the way chosen unless there's nowhere left to go that way.
  const focusStop = useCallback(
    (station: Station) => {
      if (!routes || station.id === fromStationId) return;
      haptics.selection();
      const stopIndex = (routes[direction.route] ?? []).indexOf(station.id);
      const next = getDirectionTo(routes, direction.route, stopIndex, station.id, direction);
      setExpandedGaps(new Set());
      setIsDirectionsOpen(false);
      setPendingStop(null);
      setPendingOffset(null);
      scrollRef.current?.scrollToOffset({ offset: 0, animated: true });
      onFocusStop(station, next);
    },
    [routes, fromStationId, direction, scrollRef, onFocusStop],
  );

  const toggleDirections = useCallback(() => setIsDirectionsOpen((open) => !open), []);

  const changeDirection = useCallback(
    (next: LineDirection) => {
      setPendingStop(null);
      setPendingOffset(null);
      scrollRef.current?.scrollToOffset({ offset: 0, animated: false });
      onDirectionChange(next);
      setIsDirectionsOpen(false);
    },
    [onDirectionChange, scrollRef],
  );

  const intro =
    !stops || !stationsById || !routes ? (
      <StopsSkeleton color={trackColor} />
    ) : (
      <>
        <View className="px-4">
          <Animated.View
            style={diagramStyle}
            pointerEvents={diagramVisible ? "auto" : "none"}
            accessibilityElementsHidden={!diagramVisible}
            importantForAccessibility={diagramVisible ? "auto" : "no-hide-descendants"}
          >
            <LineDiagram
              line={line}
              routes={routes}
              selected={direction.route}
              reversed={direction.reversed}
              fromStationId={fromStationId}
              stationsById={stationsById}
              onSelectStop={selectDiagramStop}
            />
          </Animated.View>
          {selectedOption ? (
            <GoingTowards
              options={options}
              selected={selectedOption}
              color={color}
              nameOf={nameOf}
              isOpen={isDirectionsOpen}
              onToggle={toggleDirections}
              onChange={changeDirection}
            />
          ) : null}
        </View>
        {stops.length === 0 ? (
          <StatusMessage
            icon={CircleAlert}
            title="No stops to show"
            description="This line's stops couldn't be loaded."
          />
        ) : (
          <View className="h-4" />
        )}
      </>
    );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ListItem>) => {
      switch (item.type) {
        case "intro":
          return (
            <View onLayout={(event) => setIntroHeight(event.nativeEvent.layout.height)}>
              {intro}
            </View>
          );
        case "gap":
          return (
            <HiddenStopsRow
              count={item.count}
              rowHeight={rowHeight}
              color={trackColor}
              onExpand={() => expandGap(item.from)}
            />
          );
        default:
          return (
            <LineStop
              item={item}
              rowHeight={rowHeight}
              line={line}
              color={trackColor}
              isHighlighted={item.station.id === fromStationId}
              onSelect={focusStop}
            />
          );
      }
    },
    [intro, line, trackColor, fromStationId, focusStop, expandGap, rowHeight],
  );

  return (
    <Animated.View style={[styles.fill, fillStyle]}>
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
            actions={<HeaderActions line={line} />}
          >
            <LineSubtitle line={line} />
          </SheetHeader>
          <LiveService line={line} />
        </View>
        <SheetHeaderFade scrollOffset={scrollOffset} />
      </PinnedSheetHeader>
      <BottomSheetFlatList
        // Gorhom forwards the RN FlatList instance; its declared ref exposes only list methods.
        ref={scrollRef as Ref<BottomSheetFlatListMethods>}
        data={items}
        keyExtractor={itemKey}
        renderItem={renderItem}
        // The diagram fills much of the first screen. Keep a small buffer around
        // the visible stops instead of mounting most of a long route at once.
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={3}
        getItemLayout={getItemLayout}
        removeClippedSubviews={false}
        contentContainerStyle={{ paddingTop: headerHeight, paddingBottom: bottomInset }}
        scrollIndicatorInsets={{ top: headerHeight }}
        onContentSizeChange={(_, height) => onContentHeightChange(height)}
        ListFooterComponent={<LineAbout line={line} />}
      />
    </Animated.View>
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
  /** Changes each time the line is opened, which starts its sheet over. */
  openKey: number;
  isOpen: boolean;
  /** The station GeoJSON the map shows, which names the line's stops. */
  stationsUrl: string | null;
  fromStationId: string | null;
  direction: LineDirection;
  onDirectionChange: (direction: LineDirection) => void;
  onClose: (action: SheetCloseAction) => void;
  onFocusStop: (station: Station, direction: LineDirection) => void;
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
  direction,
  onDirectionChange,
  onClose,
  onFocusStop,
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

  // Each opening starts at the middle step.
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    if (!isOpen) {
      sheetRef.current?.close();
      return;
    }
    sheetRef.current?.snapToIndex(0);
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
      accessible={false}
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
          direction={direction}
          onDirectionChange={onDirectionChange}
          onClose={() => onClose("back")}
          onFocusStop={onFocusStop}
          onContentHeightChange={setContentHeight}
        />
      </ErrorBoundary>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  gapDot: { width: 3, height: 3, borderRadius: 1.5 },
  stripBar: { position: "absolute", width: 4 },
  stripDots: {
    position: "absolute",
    width: 4,
    alignItems: "center",
    justifyContent: "space-evenly",
  },
  fillStrip: { top: 0, bottom: 0, left: 12 },
  stopDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2.5 },
  bigDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 3 },
  focusDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  focusCenter: { width: 6, height: 6, borderRadius: 3 },
  railIcon: { width: 18, height: 18 },
});
