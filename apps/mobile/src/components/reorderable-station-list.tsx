import type { Station } from "@repo/data/types";
import { useThemeColor } from "heroui-native/hooks";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
  type SectionListProps,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolateColor,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { RowSeparator, StationRow } from "@/components/station-list";
import { haptics } from "@/lib/haptics";

/** How long a row has to be held before it lifts. Moving sooner scrolls the list instead. */
const liftDelayMs = 350;
/** The list's corners, like the other station lists (rounded-3xl). */
const listRadius = 24;
/** The corners of a lifted row away from the list's ends. */
const liftedRadius = 16;
const liftedScale = 1.03;
const liftTiming = { duration: 150 };
/** Slower than the lift, so the shadow fades as the row lands. */
const lowerTiming = { duration: 250 };
/** The pressed highlight fades into the lift instead of switching off. */
const highlightTiming = { duration: 250 };
/**
 * Moves rows into their slots, both when making way and after a drop. A spring keeps a row's speed
 * when its target changes mid-move, where a timing would restart from rest. Critically damped, so
 * rows don't bounce. The mass is set because Reanimated's default (4) makes these values bouncy.
 */
const settleSpring = { mass: 1, stiffness: 400, damping: 40 };
/** The most of the finger's speed a dropped row keeps, in points per second. More overshoots. */
const maxDropVelocity = 300;

/** Each station's slot in the list, by ID. */
type Positions = Record<string, number>;

function toPositions(stations: Station[]): Positions {
  return Object.fromEntries(stations.map((station, index) => [station.id, index]));
}

/** Moves one station to a slot, shifting the ones in between by one. */
function moveTo(positions: Positions, id: string, to: number): Positions {
  "worklet";
  const from = positions[id] ?? to;
  const next: Positions = {};
  for (const key in positions) {
    const position = positions[key]!;
    if (key === id) next[key] = to;
    else if (from < to && position > from && position <= to) next[key] = position - 1;
    else if (from > to && position >= to && position < from) next[key] = position + 1;
    else next[key] = position;
  }
  return next;
}

// All rows have the same height. Kept across mounts to avoid another measurement pass.
let measuredRowHeight = 0;

interface RowProps {
  station: Station;
  index: number;
  count: number;
  rowHeight: number;
  positions: SharedValue<Positions>;
  activeId: SharedValue<string | null>;
  raisedId: SharedValue<string | null>;
  liftColor: string;
  pressedColor: string;
  renderSuffix?: (station: Station) => ReactNode;
  onSelect: (station: Station) => void;
  onMove: (id: string, to: number) => void;
  onLift: () => void;
  onDrop: (id: string, from: number, to: number) => void;
  onRowLayout: (event: LayoutChangeEvent) => void;
}

const ReorderableRow = memo(function ReorderableRow({
  station,
  index,
  count,
  rowHeight,
  positions,
  activeId,
  raisedId,
  liftColor,
  pressedColor,
  renderSuffix,
  onSelect,
  onMove,
  onLift,
  onDrop,
  onRowLayout,
}: RowProps) {
  const id = station.id;
  const top = useSharedValue(index * rowHeight);
  const lastTarget = useSharedValue(index * rowHeight);
  const startTop = useSharedValue(0);
  const startPosition = useSharedValue(index);
  const highlight = useSharedValue(0);
  const lifted = useDerivedValue(() =>
    activeId.get() === id ? withTiming(1, liftTiming) : withTiming(0, lowerTiming),
  );

  // Rows make way for the dragged one, and settle into a new order after saves and removals.
  useAnimatedReaction(
    () => (activeId.get() === id ? null : (positions.get()[id] ?? index) * rowHeight),
    (target) => {
      // Every move updates all the positions. Rows whose slot didn't change keep their animation,
      // and so does a dropped row once its new order is saved.
      if (target === null || target === lastTarget.get()) return;
      lastTarget.set(target);
      top.set(withSpring(target, settleSpring));
    },
    [id, index, rowHeight],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        // Moving before the delay fails it, so the list and the sheet still scroll and drag.
        .activateAfterLongPress(liftDelayMs)
        .onStart(() => {
          // One row at a time, even with a second finger on another.
          if (activeId.get() !== null) return;
          // From where the row is now, in case it's still moving out of another one's way.
          startTop.set(top.get());
          startPosition.set(positions.get()[id] ?? index);
          activeId.set(id);
          raisedId.set(id);
          // Takes over from the row's pressed highlight, which the lift cancels.
          highlight.set(1);
          highlight.set(withTiming(0, highlightTiming));
          scheduleOnRN(onLift);
        })
        .onUpdate((event) => {
          if (activeId.get() !== id) return;
          const y = Math.min(
            Math.max(startTop.get() + event.translationY, 0),
            (count - 1) * rowHeight,
          );
          top.set(y);
          const to = Math.round(y / rowHeight);
          if (to !== positions.get()[id]) {
            positions.set(moveTo(positions.get(), id, to));
            scheduleOnRN(haptics.selection);
          }
        })
        .onFinalize((event) => {
          if (activeId.get() !== id) return;
          const position = positions.get()[id] ?? index;
          lastTarget.set(position * rowHeight);
          activeId.set(null);
          // The row carries on at the finger's speed, unless it was held at the list's ends.
          const y = top.get();
          const isAtEnd = y <= 0 || y >= (count - 1) * rowHeight;
          const velocity = isAtEnd
            ? 0
            : Math.min(Math.max(event.velocityY, -maxDropVelocity), maxDropVelocity);
          top.set(
            // Also lowered when interrupted, by a new lift or the order changing elsewhere.
            withSpring(position * rowHeight, { ...settleSpring, velocity }, () => {
              if (raisedId.get() === id && activeId.get() !== id) raisedId.set(null);
            }),
          );
          scheduleOnRN(onDrop, id, startPosition.get(), position);
        }),
    [
      id,
      index,
      count,
      rowHeight,
      positions,
      activeId,
      top,
      lastTarget,
      startTop,
      startPosition,
      raisedId,
      highlight,
      onLift,
      onDrop,
    ],
  );

  const rowStyle = useAnimatedStyle(() => ({
    // The virtualized cell supplies the row's baseline position. Only animate the difference
    // from it, so saving the new order doesn't translate the row a second time.
    transform: [
      { translateY: top.get() - index * rowHeight },
      { scale: 1 + lifted.get() * (liftedScale - 1) },
    ],
  }));
  // Rounded at the list's ends, so the pressed highlight keeps its corners, and all round when
  // lifted.
  const shapeStyle = useAnimatedStyle(() => {
    const position = positions.get()[id] ?? index;
    const lift = lifted.get() * liftedRadius;
    const topRadius = Math.max(position === 0 ? listRadius : 0, lift);
    const bottomRadius = Math.max(position === count - 1 ? listRadius : 0, lift);
    return {
      borderTopLeftRadius: topRadius,
      borderTopRightRadius: topRadius,
      borderBottomLeftRadius: bottomRadius,
      borderBottomRightRadius: bottomRadius,
    };
  });
  const liftStyle = useAnimatedStyle(() => ({
    opacity: Math.max(lifted.get(), highlight.get()),
    backgroundColor: interpolateColor(highlight.get(), [0, 1], [liftColor, pressedColor]),
  }));
  const separatorStyle = useAnimatedStyle(() => ({
    opacity: (positions.get()[id] ?? index) > 0 ? 1 - lifted.get() : 0,
  }));

  const accessibilityActions = useMemo(
    () => [
      ...(index > 0 ? [{ name: "moveUp", label: "Move up" }] : []),
      ...(index < count - 1 ? [{ name: "moveDown", label: "Move down" }] : []),
    ],
    [index, count],
  );
  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === "moveUp") onMove(id, index - 1);
      if (event.nativeEvent.actionName === "moveDown") onMove(id, index + 1);
    },
    [id, index, onMove],
  );

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        className="bg-surface-secondary"
        style={[styles.surface, shapeStyle, rowStyle]}
        onLayout={onRowLayout}
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.lift, shapeStyle, liftStyle]}
        />
        <Animated.View pointerEvents="none" style={[styles.separator, separatorStyle]}>
          <RowSeparator />
        </Animated.View>
        <Animated.View style={[styles.clip, shapeStyle]}>
          <StationRow
            station={station}
            renderSuffix={renderSuffix}
            onSelect={onSelect}
            accessibilityActions={accessibilityActions}
            onAccessibilityAction={onAccessibilityAction}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

/** Marks saved rows separately from stations in other sections (or section headers). */
export interface SavedStationItem {
  savedStation: Station;
}

export function isSavedStationItem(item: unknown): item is SavedStationItem {
  return typeof item === "object" && item !== null && "savedStation" in item;
}

type ReorderState = Omit<RowProps, "station" | "index" | "renderSuffix" | "onSelect">;
const ReorderContext = createContext<ReorderState | null>(null);

function useReorderState() {
  const state = useContext(ReorderContext);
  if (!state) throw new Error("Saved station rows need a ReorderableStationsProvider");
  return state;
}

/** Drag state outlives individual cells, which the SectionList can unmount offscreen. */
export function ReorderableStationsProvider({
  stations,
  onMove,
  onDragActiveChange,
  children,
}: {
  stations: Station[];
  /** Moves a station to another slot, by its index in `stations`. */
  onMove: (id: string, to: number) => void;
  /** While a row is lifted, so its container can stop scrolling. */
  onDragActiveChange?: (isActive: boolean) => void;
  children: ReactNode;
}) {
  const liftColor = useThemeColor("surface-secondary");
  // The rows' pressed highlight (active:bg-surface-tertiary).
  const pressedColor = useThemeColor("surface-tertiary");
  const [rowHeight, setRowHeight] = useState(measuredRowHeight);
  const initialPositions = useMemo(() => toPositions(stations), [stations]);
  const positions = useSharedValue(initialPositions);
  const activeId = useSharedValue<string | null>(null);
  const raisedId = useSharedValue<string | null>(null);

  // Only when the order really changes: a new array with the same stations would otherwise
  // reset a drag in progress.
  const order = stations.map((station) => station.id).join("\n");
  const previousOrder = useRef(order);
  useEffect(() => {
    if (previousOrder.current === order) return;
    previousOrder.current = order;
    positions.set(initialPositions);
    // A removal or collapse during a drag must release the scroll lock. A normal drop has
    // already cleared activeId, so its landing animation can continue.
    if (activeId.get() !== null) {
      activeId.set(null);
      raisedId.set(null);
      onDragActiveChange?.(false);
    }
  }, [order, initialPositions, positions, activeId, raisedId, onDragActiveChange]);

  // A list removed mid-drag can't drop its row, so it lets its container scroll again itself.
  useEffect(
    () => () => {
      activeId.set(null);
      raisedId.set(null);
      onDragActiveChange?.(false);
    },
    [activeId, raisedId, onDragActiveChange],
  );

  const onRowLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height <= 0) return;
    measuredRowHeight = height;
    setRowHeight(height);
  }, []);

  const onLift = useCallback(() => {
    haptics.lift();
    onDragActiveChange?.(true);
  }, [onDragActiveChange]);

  const onDrop = useCallback(
    (id: string, from: number, to: number) => {
      onDragActiveChange?.(false);
      if (from !== to) onMove(id, to);
    },
    [onDragActiveChange, onMove],
  );

  const state = useMemo<ReorderState>(
    () => ({
      count: stations.length,
      rowHeight,
      positions,
      activeId,
      raisedId,
      liftColor,
      pressedColor,
      onMove,
      onLift,
      onDrop,
      onRowLayout,
    }),
    [
      stations.length,
      rowHeight,
      positions,
      activeId,
      raisedId,
      liftColor,
      pressedColor,
      onMove,
      onLift,
      onDrop,
      onRowLayout,
    ],
  );
  return <ReorderContext value={state}>{children}</ReorderContext>;
}

/** One saved row per virtualized item; long press to reorder, or use screen reader actions. */
export const ReorderableStationRow = memo(function ReorderableStationRow({
  station,
  index,
  renderSuffix,
  onSelect,
}: Pick<RowProps, "station" | "index" | "renderSuffix" | "onSelect">) {
  const state = useReorderState();
  // Only the rendered cells participate in the initial height measurement.
  if (state.rowHeight === 0) {
    return (
      <View
        onLayout={state.onRowLayout}
        className={`bg-surface-secondary overflow-hidden ${index === 0 ? "rounded-t-3xl" : ""} ${index === state.count - 1 ? "rounded-b-3xl" : ""}`}
      >
        {index > 0 ? (
          <View style={styles.separator}>
            <RowSeparator />
          </View>
        ) : null}
        <StationRow station={station} renderSuffix={renderSuffix} onSelect={onSelect} />
      </View>
    );
  }
  return (
    <ReorderableRow
      {...state}
      station={station}
      index={index}
      renderSuffix={renderSuffix}
      onSelect={onSelect}
    />
  );
});

type CellProps = ComponentProps<NonNullable<SectionListProps<unknown>["CellRendererComponent"]>>;

function SavedStationCell({
  item,
  style,
  onLayout,
  onFocusCapture,
  children,
}: CellProps & {
  item: SavedStationItem;
}) {
  const { activeId, raisedId } = useReorderState();
  const id = item.savedStation.id;
  const cellStyle = useAnimatedStyle(() => ({
    zIndex: activeId.get() === id ? 2 : raisedId.get() === id ? 1 : 0,
  }));
  // VirtualizedList supplies the focus callback even though ViewProps doesn't declare it.
  const callbacks = { onLayout, onFocusCapture };
  return (
    <Animated.View collapsable={false} style={[style, cellStyle]} {...callbacks}>
      {children}
    </Animated.View>
  );
}

/** Raise the cell itself so a dragged row stays above neighbouring virtualized cells. */
export function ReorderableStationCell(props: CellProps) {
  if (isSavedStationItem(props.item)) return <SavedStationCell {...props} item={props.item} />;
  const callbacks = { onLayout: props.onLayout, onFocusCapture: props.onFocusCapture };
  return (
    <View style={props.style} {...callbacks}>
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { borderCurve: "continuous" },
  lift: { boxShadow: "0 6px 16px rgba(0, 0, 0, 0.18)" },
  separator: { position: "absolute", top: 0, left: 0, right: 0 },
  clip: { overflow: "hidden" },
});
