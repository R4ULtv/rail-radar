import { CloseButton } from "heroui-native/close-button";
import { useThemeColor } from "heroui-native/hooks";
import { LinearGradient } from "expo-linear-gradient";
import type { Component, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
  type SharedValue,
} from "react-native-reanimated";

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
  leading,
  actions,
  children,
}: {
  title: string;
  /** Lines the title can wrap to; unlimited by default. */
  titleLines?: number;
  closeLabel: string;
  onClose: () => void;
  /** Before the title, e.g. a line's badge. */
  leading?: ReactNode;
  /** Small buttons before the close button, e.g. to save or share. */
  actions?: ReactNode;
  /** Shown below the title, e.g. a subtitle. */
  children?: ReactNode;
}) {
  return (
    <View className="flex-row items-start gap-3">
      {leading}
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
      {actions ? (
        <View className="flex-row items-center gap-2">
          {actions}
          <CloseButton accessibilityLabel={closeLabel} onPress={onClose} />
        </View>
      ) : (
        <CloseButton accessibilityLabel={closeLabel} onPress={onClose} />
      )}
    </View>
  );
}

/**
 * A header pinned over the top of a sheet's list, in place of a sticky header. React Native's
 * sticky headers catch up with the scroll a moment late, so while the sheet is dragged and resets
 * its list's scroll, they jumped away from the top of the sheet. Pad the list's top by the
 * header's height: it stays part of the list's content, so the sheet still opens only as tall as
 * it needs.
 */
export function PinnedSheetHeader({
  onHeightChange,
  collapsedBy,
  children,
}: {
  onHeightChange: (height: number) => void;
  /**
   * How much shorter the header looks, e.g. once a row of it has moved out of the way. It keeps
   * its height, so the list's padding doesn't change, and the list shows through below. Its
   * children move themselves, and leave touches there to the list with `pointerEvents`.
   */
  collapsedBy?: SharedValue<number>;
  children: ReactNode;
}) {
  const color = useThemeColor("surface");
  const backgroundStyle = useAnimatedStyle(() => ({ bottom: collapsedBy?.get() ?? 0 }));
  return (
    <View
      pointerEvents={collapsedBy ? "box-none" : "auto"}
      style={[styles.pinned, collapsedBy ? null : { backgroundColor: color }]}
      onLayout={(event) => onHeightChange(event.nativeEvent.layout.height)}
    >
      {collapsedBy ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.pinnedBackground, { backgroundColor: color }, backgroundStyle]}
        />
      ) : null}
      {children}
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

/**
 * A theme color, which Uniwind resolves to hex, made fully transparent. Fading to it rather than
 * to "transparent" keeps a gradient from going grey on the way.
 */
export function transparent(color: string) {
  return `${color.slice(0, 7)}00`;
}

/** A sheet list's scroll position, for its header fade. Pass the ref to the scrollable. */
export function useSheetScrollOffset<T extends Component = Animated.ScrollView>() {
  const scrollRef = useAnimatedRef<T>();
  const scrollOffset = useScrollOffset(scrollRef);
  return [scrollRef, scrollOffset] as const;
}

/**
 * The bottom edge of a sticky header: lists fade out under it instead of being cut off. It hangs
 * below the header, so give it a parent without padding, and leave the gap above the list.
 */
export function SheetHeaderFade({
  scrollOffset,
  collapsedBy,
}: {
  scrollOffset: SharedValue<number>;
  /** The header's `collapsedBy`, to stay at the bottom of what's left of it. */
  collapsedBy?: SharedValue<number>;
}) {
  const color = useThemeColor("surface");
  const shiftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -(collapsedBy?.get() ?? 0) }],
  }));
  const fadeStyle = useAnimatedStyle(() => ({
    transform: [
      { scaleY: cssEaseInOut(Math.min(Math.max(scrollOffset.get(), 0) / fadeRevealDistance, 1)) },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.fade, shiftStyle]}>
      <View style={[styles.fadeGap, { backgroundColor: color }]} />
      <Animated.View style={[styles.fadeGradient, fadeStyle]}>
        <LinearGradient colors={[color, transparent(color)]} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Drawn over the list, which comes after it so screen readers still start at the header.
  pinned: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 },
  pinnedBackground: { position: "absolute", top: 0, left: 0, right: 0 },
  fade: { position: "absolute", top: "100%", left: 0, right: 0 },
  fadeGap: { height: fadeGap },
  // Scaled from the top, which moves where it turns transparent like the web's mask does.
  fadeGradient: { height: fadeSize, transformOrigin: "top" },
  title: { flex: 1, minWidth: 0 },
});
