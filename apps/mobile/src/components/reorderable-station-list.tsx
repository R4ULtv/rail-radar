import type { Station } from "@repo/data/types";
import { useThemeColor } from "heroui-native/hooks";
import { ListGroup } from "heroui-native/list-group";
import { Fragment, memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
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

// All rows have the same height. Kept across mounts, so the list only lays out in flow once.
let measuredRowHeight = 0;

interface RowProps {
  station: Station;
  index: number;
  count: number;
  rowHeight: number;
  positions: SharedValue<Positions>;
  activeId: SharedValue<string | null>;
  liftColor: string;
  pressedColor: string;
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
  liftColor,
  pressedColor,
  onSelect,
  onMove,
  onLift,
  onDrop,
  onRowLayout,
}: RowProps) {
  const id = station.id;
  const top = useSharedValue(index * rowHeight);
  const startTop = useSharedValue(0);
  const startPosition = useSharedValue(index);
  // Above the rows it passes while it settles after a drop. The dragged row is always on top.
  const isRaised = useSharedValue(false);
  const highlight = useSharedValue(0);
  const lifted = useDerivedValue(() =>
    activeId.get() === id ? withTiming(1, liftTiming) : withTiming(0, lowerTiming),
  );

  // Rows make way for the dragged one, and settle into a new order after saves and removals.
  // Not rebuilt when the index changes after a drop: the index is only a fallback until the row
  // has a position.
  useAnimatedReaction(
    () => (positions.get()[id] ?? index) * rowHeight,
    (target, previous) => {
      // Every move updates all the positions. Rows whose slot didn't change keep their animation,
      // and so does a dropped row once its new order is saved.
      if (target === previous || activeId.get() === id) return;
      top.set(previous === null ? target : withSpring(target, settleSpring));
    },
    [id, rowHeight],
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
          isRaised.set(true);
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
              isRaised.set(false);
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
      startTop,
      startPosition,
      isRaised,
      highlight,
      onLift,
      onDrop,
    ],
  );

  const rowStyle = useAnimatedStyle(() => ({
    zIndex: activeId.get() === id ? 2 : isRaised.get() ? 1 : 0,
    transform: [{ translateY: top.get() }, { scale: 1 + lifted.get() * (liftedScale - 1) }],
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
      <Animated.View style={[styles.row, rowStyle]} onLayout={onRowLayout}>
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
            onSelect={onSelect}
            accessibilityActions={accessibilityActions}
            onAccessibilityAction={onAccessibilityAction}
          />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
});

/**
 * A station list whose order can be changed: hold a row until it lifts, then drag it to its new
 * place. Screen readers get "Move up" and "Move down" actions instead.
 */
export const ReorderableStationList = memo(function ReorderableStationList({
  stations,
  onSelect,
  onMove,
  onDragActiveChange,
}: {
  stations: Station[];
  onSelect: (station: Station) => void;
  /** Moves a station to another slot, by its index in `stations`. */
  onMove: (id: string, to: number) => void;
  /** While a row is lifted, so its container can stop scrolling. */
  onDragActiveChange?: (isActive: boolean) => void;
}) {
  const liftColor = useThemeColor("surface-secondary");
  // The rows' pressed highlight (active:bg-surface-tertiary).
  const pressedColor = useThemeColor("surface-tertiary");
  const [rowHeight, setRowHeight] = useState(measuredRowHeight);
  const positions = useSharedValue(toPositions(stations));
  const activeId = useSharedValue<string | null>(null);

  // Only when the order really changes: a new array with the same stations would otherwise
  // reset a drag in progress.
  const order = stations.map((station) => station.id).join("\n");
  useEffect(() => {
    positions.set(toPositions(stations));
  }, [order, positions]); // `order` stands in for `stations`.

  // A list removed mid-drag can't drop its row, so it lets its container scroll again itself.
  useEffect(() => () => onDragActiveChange?.(false), [onDragActiveChange]);

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

  if (stations.length === 0) return null;

  // The first time, the rows lay out like the other lists to measure their height.
  if (rowHeight === 0) {
    return (
      <ListGroup variant="secondary" className="overflow-hidden">
        {stations.map((station, index) => (
          <Fragment key={station.id}>
            {index > 0 ? <RowSeparator /> : null}
            <View onLayout={index === 0 ? onRowLayout : undefined}>
              <StationRow station={station} onSelect={onSelect} />
            </View>
          </Fragment>
        ))}
      </ListGroup>
    );
  }

  return (
    <View
      className="rounded-3xl bg-surface-secondary"
      style={[styles.list, { height: stations.length * rowHeight }]}
    >
      {stations.map((station, index) => (
        <ReorderableRow
          key={station.id}
          station={station}
          index={index}
          count={stations.length}
          rowHeight={rowHeight}
          positions={positions}
          activeId={activeId}
          liftColor={liftColor}
          pressedColor={pressedColor}
          onSelect={onSelect}
          onMove={onMove}
          onLift={onLift}
          onDrop={onDrop}
          onRowLayout={onRowLayout}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  list: { borderCurve: "continuous" },
  row: { position: "absolute", top: 0, left: 0, right: 0 },
  lift: { boxShadow: "0 6px 16px rgba(0, 0, 0, 0.18)" },
  separator: { position: "absolute", top: 0, left: 0, right: 0 },
  clip: { overflow: "hidden" },
});
