import { useThemeColor } from "heroui-native/hooks";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";

/** Like the bottom sheets' handle; only on iOS, where a page sheet can be swiped down. */
export function PageSheetHandle() {
  const mutedColor = useThemeColor("muted");
  const { width } = useWindowDimensions();

  if (Platform.OS !== "ios") return null;
  return (
    <View style={styles.handle} accessibilityElementsHidden importantForAccessibility="no">
      <View style={[styles.indicator, { width: width * 0.075, backgroundColor: mutedColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  handle: { height: 24, justifyContent: "center" },
  indicator: { alignSelf: "center", height: 4, borderRadius: 4 },
});
