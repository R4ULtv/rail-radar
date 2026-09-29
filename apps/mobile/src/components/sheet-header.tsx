import { CloseButton } from "heroui-native/close-button";
import { useThemeColor } from "heroui-native/hooks";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

/** The map sheets' rounded background, with a shadow that sets it apart from a light map. */
export const sheetBackgroundStyle = {
  borderRadius: 24,
  shadowColor: "#000",
  shadowOpacity: 0.12,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: -2 },
  elevation: 12,
} as const;

/** Every sheet's title, on the left with the close button across from it. */
export function SheetHeader({
  title,
  titleLines,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  /** Lines the title can wrap to; unlimited by default. */
  titleLines?: number;
  closeLabel: string;
  onClose: () => void;
  /** Shown below the title, e.g. a subtitle. */
  children?: ReactNode;
}) {
  return (
    <View className="flex-row items-start gap-3">
      <View style={styles.title}>
        <Text
          accessibilityRole="header"
          className="text-xl font-semibold text-foreground"
          numberOfLines={titleLines}
        >
          {title}
        </Text>
        {children}
      </View>
      <CloseButton accessibilityLabel={closeLabel} onPress={onClose} />
    </View>
  );
}

// The same fade as the web's lists: it grows in over the first stretch of scrolling, so it's not
// there at the top.
const fadeSize = 40;
const fadeRevealDistance = 96;
const cssEaseInOut = Easing.bezierFn(0.42, 0, 0.58, 1);
// Always solid under the header, so lists never scroll right up against it.
const fadeGap = 8;

/** A sheet list's scroll position, for its header fade. Pass the ref to the scroll view. */
export function useSheetScrollOffset() {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);
  return [scrollRef, scrollOffset] as const;
}

/**
 * The bottom edge of a sticky header: lists fade out under it instead of being cut off. It hangs
 * below the header, so give it a parent without side padding, and leave the gap above the list.
 */
export function SheetHeaderFade({ scrollOffset }: { scrollOffset: SharedValue<number> }) {
  const color = useThemeColor("surface");
  const fadeStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleY: cssEaseInOut(Math.min(Math.max(scrollOffset.get(), 0) / fadeRevealDistance, 1)) },
    ],
  }));
  return (
    <View pointerEvents="none" style={styles.fade}>
      <View style={[styles.fadeGap, { backgroundColor: color }]} />
      <Animated.View style={[styles.fadeGradient, fadeStyle]}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#fade)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fade: { position: "absolute", top: "100%", left: 0, right: 0 },
  fadeGap: { height: fadeGap },
  // Scaled from the top, which moves where it turns transparent like the web's mask does.
  fadeGradient: { height: fadeSize, transformOrigin: "top" },
  title: { flex: 1, minWidth: 0 },
});
