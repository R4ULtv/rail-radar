import Mapbox from "@rnmapbox/maps";
import { useThemeColor } from "heroui-native/hooks";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

// Tailwind's animate-ping: grow to 2x and fade out over 75% of a 1s loop.
const pingEasing = Easing.bezier(0, 0, 0.2, 1);

function PingRing({ color }: { color: string }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 750, easing: pingEasing }),
        withDelay(250, withTiming(0, { duration: 0 })),
      ),
      -1,
    );
  }, [progress, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - progress.value),
    transform: [{ scale: 1 + progress.value }],
  }));

  return <Animated.View style={[styles.ping, { backgroundColor: color }, style]} />;
}

/** The web map's location marker: an accent dot with a white ring, a soft halo and a ping. */
export function UserLocationMarker() {
  const accent = useThemeColor("accent");
  const [coordinate, setCoordinate] = useState<[number, number] | null>(null);

  return (
    <>
      <Mapbox.UserLocation
        visible={false}
        minDisplacement={5}
        onUpdate={(location) =>
          setCoordinate([location.coords.longitude, location.coords.latitude])
        }
      />
      {coordinate ? (
        <Mapbox.MarkerView coordinate={coordinate} allowOverlap allowOverlapWithPuck>
          <View pointerEvents="none" style={styles.marker}>
            <View style={[styles.halo, { backgroundColor: accent }]} />
            <PingRing color={accent} />
            <View style={[styles.dot, { backgroundColor: accent }]} />
          </View>
        </Mapbox.MarkerView>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  // Sized for the ping at full scale so it isn't clipped.
  marker: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 32, height: 32, borderRadius: 16, opacity: 0.2 },
  ping: { position: "absolute", width: 20, height: 20, borderRadius: 10 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
});
