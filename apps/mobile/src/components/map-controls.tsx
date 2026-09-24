import { useThemeColor } from "heroui-native/hooks";
import Locate from "lucide-react-native/icons/locate";
import LocateFixed from "lucide-react-native/icons/locate-fixed";
import LocateOff from "lucide-react-native/icons/locate-off";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Line, Path } from "react-native-svg";

// Round map buttons, modelled on Apple Maps.
const controlSize = 40;
const center = controlSize / 2;
// Headings closer to north than this count as north-up.
const northThreshold = 1;

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

export type LocationStatus = "idle" | "locating" | "located" | "off";

const locateLabels: Record<LocationStatus, string> = {
  idle: "Locate me",
  locating: "Finding your location",
  located: "Show my location",
  off: "Location is off",
};

/** Same icons as the web map: locate, then locate-fixed once found; locate-off when unavailable. */
export function LocateButton({ status, onPress }: { status: LocationStatus; onPress: () => void }) {
  const [foreground, accent, muted] = useThemeColor(["foreground", "accent", "muted"]);
  const Icon = status === "off" ? LocateOff : status === "located" ? LocateFixed : Locate;
  const color = status === "off" ? muted : status === "located" ? accent : foreground;

  return (
    <MapControl
      accessibilityLabel={locateLabels[status]}
      accessibilityState={{ busy: status === "locating" }}
      disabled={status === "locating"}
      onPress={onPress}
    >
      <Icon size={20} color={color} style={{ opacity: status === "locating" ? 0.5 : 1 }} />
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
});
