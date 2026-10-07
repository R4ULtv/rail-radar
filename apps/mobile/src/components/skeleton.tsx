import { LinearGradient } from "expo-linear-gradient";
import { useThemeColor } from "heroui-native/hooks";
import { colorKit } from "heroui-native/utils";
import { useEffect } from "react";
import type { LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  makeMutable,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useUniwind } from "uniwind";

import { transparent } from "@/components/sheet-header";

// One sweep for every bone on screen, running while any is mounted, so the bones shimmer in step
// and a screen of them costs one animation rather than one each.
const progress = makeMutable(0);
let mountedBones = 0;

function useShimmerProgress() {
  useEffect(() => {
    if (mountedBones++ === 0) {
      progress.set(
        withRepeat(
          withTiming(1, { duration: 1500, easing: Easing.linear }),
          -1,
          false,
          undefined,
          ReduceMotion.System,
        ),
      );
    }
    return () => {
      if (--mountedBones === 0) {
        cancelAnimation(progress);
        progress.set(0);
      }
    };
  }, []);
  return progress;
}

/**
 * HeroUI's shimmering skeleton, redrawn with a native gradient. HeroUI's draws each bone's
 * highlight with react-native-svg, which on Android mounted four native views per bone and drew
 * each into a new bitmap, as the station sheet opened over a screen of bones. It also has no fade
 * in or out: on Android, a fade-out that was cut short (its list unmounted mid-fade) left the bones
 * stuck on screen, over every sheet, until a restart.
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useUniwind();
  const background = useThemeColor("background");
  const { width: screenWidth } = useWindowDimensions();
  const progress = useShimmerProgress();
  // Measured into shared values rather than state, so a bone mounts once rather than again with its
  // highlight.
  const width = useSharedValue(0);
  const x = useSharedValue(0);

  // HeroUI's highlight colors.
  const highlight =
    theme === "dark"
      ? colorKit.setAlpha(colorKit.increaseBrightness(background, 10).hex(), 0.1).hex()
      : colorKit.setAlpha(colorKit.decreaseBrightness(background, 10).hex(), 0.75).hex();

  const onLayout = (event: LayoutChangeEvent) => {
    width.set(event.nativeEvent.layout.width);
    x.set(event.nativeEvent.layout.x);
  };

  // Sweeps from just left of the bone to the screen's right edge, as HeroUI's does, so the bones in
  // a row share one highlight. Until measured, the highlight waits off to the right.
  const highlightStyle = useAnimatedStyle(() => {
    const start = -(width.get() + x.get());
    const translateX =
      width.get() === 0 ? screenWidth : start + (screenWidth - start) * progress.get();
    return { transform: [{ translateX }] };
  });

  return (
    <View
      className={`skeleton__root ${className ?? ""}`}
      style={[styles.bone, style]}
      onLayout={onLayout}
    >
      <Animated.View style={[StyleSheet.absoluteFill, highlightStyle]}>
        <LinearGradient
          colors={[transparent(highlight), highlight, transparent(highlight)]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bone: { borderCurve: "continuous", overflow: "hidden" },
});
