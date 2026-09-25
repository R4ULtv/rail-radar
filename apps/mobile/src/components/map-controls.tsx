import { useThemeColor } from "heroui-native/hooks";
import Navigation from "lucide-react-native/icons/navigation";
import NavigationOff from "lucide-react-native/icons/navigation-off";
import Settings from "lucide-react-native/icons/settings";
import { useCallback, useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  type PressableProps,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Line, Path } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";

// Round map buttons, modelled on Apple Maps.
const controlSize = 40;
const center = controlSize / 2;
// Headings closer to north than this count as north-up.
const northThreshold = 1;
const controlGap = 10;
// Controls above the sheets are gone halfway from a sheet's smallest size to its next one.
const sheetControlsHiddenAt = 0.5;
const locateIconSize = 20;
// Lucide's arrow is weighted to the top right: its shape centers on (13.67, 10.33) of 24.
// Shifting it back by that much centers it in the button.
const arrowOffset = ((13.67 - 12) / 24) * locateIconSize;

type Direction = "N" | "E" | "S" | "W";
const directions: Direction[] = ["N", "E", "S", "W"];

function normalizeHeading(heading: number) {
  return ((heading % 360) + 360) % 360;
}

function isRotated(heading: number) {
  const normalized = normalizeHeading(heading);
  return Math.min(normalized, 360 - normalized) > northThreshold;
}

/** The cardinal direction the map faces, like the letter in Apple Maps' compass. */
function facingDirection(heading: number): Direction {
  return directions[Math.round(normalizeHeading(heading) / 90) % 4];
}

/** Tracks the map heading for the compass without re-rendering on every camera frame. */
export function useMapHeading() {
  const heading = useSharedValue(0);
  const [rotated, setRotated] = useState(false);
  const [direction, setDirection] = useState<Direction>("N");

  const onHeadingChange = useCallback(
    (value: number) => {
      heading.value = value;
      // React skips the re-render unless one of these actually changes.
      setRotated(isRotated(value));
      setDirection(facingDirection(value));
    },
    [heading],
  );

  return { heading, direction, isRotated: rotated, onHeadingChange };
}

function MapControl(props: Omit<PressableProps, "style">) {
  const [surface, border] = useThemeColor(["surface", "border"]);

  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={4}
      style={({ pressed }) => [
        styles.control,
        { backgroundColor: surface, borderColor: border, opacity: pressed ? 0.7 : 1 },
      ]}
      {...props}
    />
  );
}

export function SettingsButton({ onPress }: { onPress: () => void }) {
  const foreground = useThemeColor("foreground");

  return (
    <MapControl accessibilityLabel="Settings" onPress={onPress}>
      <Settings size={20} color={foreground} />
    </MapControl>
  );
}

/** A sheet's snap index and the top of the sheet, as Gorhom Bottom Sheet reports them. */
export interface SheetPosition {
  animatedIndex: SharedValue<number>;
  animatedPosition: SharedValue<number>;
}

/** Starts closed: index -1, at the bottom of the screen. */
export function useSheetPosition(): SheetPosition {
  const { height } = useWindowDimensions();
  const animatedIndex = useSharedValue(-1);
  const animatedPosition = useSharedValue(height);
  return { animatedIndex, animatedPosition };
}

/**
 * Keeps its controls just above the sheets, like Apple Maps, following them as they're dragged.
 * They fade out as a sheet opens beyond its smallest size.
 */
export function SheetControls({
  sheets,
  children,
}: {
  sheets: SheetPosition[];
  children: ReactNode;
}) {
  const { height } = useWindowDimensions();
  const controlsHeight = useSharedValue(0);
  const [isVisible, setIsVisible] = useState(true);
  const sheetTop = useDerivedValue(() =>
    sheets.reduce((top, sheet) => Math.min(top, sheet.animatedPosition.value), height),
  );
  const sheetIndex = useDerivedValue(() =>
    sheets.reduce((index, sheet) => Math.max(index, sheet.animatedIndex.value), -1),
  );

  useAnimatedReaction(
    () => sheetIndex.value < sheetControlsHiddenAt,
    (visible, previous) => {
      if (visible !== previous) scheduleOnRN(setIsVisible, visible);
    },
  );

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(sheetIndex.value, [0, sheetControlsHiddenAt], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: sheetTop.value - controlsHeight.value - controlGap }],
  }));

  return (
    <Animated.View
      pointerEvents={isVisible ? "box-none" : "none"}
      accessibilityElementsHidden={!isVisible}
      importantForAccessibility={isVisible ? "auto" : "no-hide-descendants"}
      style={[styles.sheetControls, style]}
      onLayout={(event) => {
        controlsHeight.value = event.nativeEvent.layout.height;
      }}
    >
      {children}
    </Animated.View>
  );
}

export type LocationStatus = "idle" | "locating" | "located" | "off";

const locateLabels: Record<LocationStatus, string> = {
  idle: "Locate me",
  locating: "Finding your location",
  located: "Show my location",
  off: "Location is off",
};

/**
 * Apple Maps' location arrow: an outline once the user is found, filled while the map is
 * centered on them, and crossed out when location is unavailable.
 */
export function LocateButton({
  status,
  isCentered,
  onPress,
}: {
  status: LocationStatus;
  /** Whether the map is on the user's location, until they move it. */
  isCentered: boolean;
  onPress: () => void;
}) {
  const [foreground, accent, muted] = useThemeColor(["foreground", "accent", "muted"]);
  const Icon = status === "off" ? NavigationOff : Navigation;
  const color = status === "off" ? muted : status === "located" ? accent : foreground;
  const isFilled = status === "located" && isCentered;

  return (
    <MapControl
      accessibilityLabel={locateLabels[status]}
      accessibilityState={{ busy: status === "locating", selected: isFilled }}
      disabled={status === "locating"}
      onPress={onPress}
    >
      <Icon
        size={locateIconSize}
        color={color}
        fill={isFilled ? color : "none"}
        style={{
          opacity: status === "locating" ? 0.5 : 1,
          transform:
            status === "off" ? [] : [{ translateX: -arrowOffset }, { translateY: arrowOffset }],
        }}
      />
    </MapControl>
  );
}

const ticks = Array.from({ length: 24 }, (_, index) => index * 15).filter((angle) => angle !== 0);

function CompassDial() {
  const [muted, danger] = useThemeColor(["muted", "danger"]);

  return (
    <Svg width={controlSize} height={controlSize} viewBox={`0 0 ${controlSize} ${controlSize}`}>
      {ticks.map((angle) => (
        <Line
          key={angle}
          x1={center}
          y1={3.5}
          x2={center}
          y2={angle % 90 === 0 ? 7.5 : 6}
          stroke={muted}
          strokeWidth={angle % 90 === 0 ? 1.4 : 1}
          strokeLinecap="round"
          transform={`rotate(${angle} ${center} ${center})`}
        />
      ))}
      <Path d={`M${center} 1.5 L${center + 3.5} 8 L${center - 3.5} 8 Z`} fill={danger} />
    </Svg>
  );
}

/**
 * Shown while the map is rotated; tap to turn north back up. The dial and its red
 * tip turn with the map, while the letter stays upright and names the facing direction.
 */
export function Compass({
  heading,
  direction,
  isRotated,
  onPress,
}: {
  heading: SharedValue<number>;
  direction: Direction;
  isRotated: boolean;
  onPress: () => void;
}) {
  const foreground = useThemeColor("foreground");
  const containerStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isRotated ? 1 : 0, { duration: 200 }),
  }));
  const dialStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-heading.value}deg` }],
  }));

  return (
    <Animated.View style={containerStyle} pointerEvents={isRotated ? "auto" : "none"}>
      <MapControl accessibilityLabel={`Facing ${direction}. Reset map to north`} onPress={onPress}>
        <Animated.View style={[StyleSheet.absoluteFill, dialStyle]}>
          <CompassDial />
        </Animated.View>
        <Text style={[styles.direction, { color: foreground }]}>{direction}</Text>
      </MapControl>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  control: {
    width: controlSize,
    height: controlSize,
    borderRadius: controlSize / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  direction: { fontSize: 13, fontWeight: "600" },
  sheetControls: { position: "absolute", top: 0, right: 16, gap: controlGap },
});
