import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { CloseButton } from "heroui-native/close-button";
import { useThemeColor } from "heroui-native/hooks";
import { useEffect, useRef } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUniwind } from "uniwind";

import { MapAttribution } from "@/components/map-attribution";
import type { SheetPosition } from "@/components/map-controls";
import { haptics } from "@/lib/haptics";
import { setMapStyle, useMapStyle, type MapStyle } from "@/lib/map-style";

// Milano Centrale at zoom 14 in each style, captured from the app on the iPhone simulator.
const previews = {
  simple: {
    light: require("../../assets/map-styles/simple-light.jpg"),
    dark: require("../../assets/map-styles/simple-dark.jpg"),
  },
  streets: {
    light: require("../../assets/map-styles/streets-light.jpg"),
    dark: require("../../assets/map-styles/streets-dark.jpg"),
  },
};

const options: { value: MapStyle; label: string }[] = [
  { value: "simple", label: "Simple" },
  { value: "streets", label: "Streets" },
];

const selectedBorderWidth = 2.5;

// Tapping the map closes the sheet, like Apple Maps' map modes, without dimming it.
function Backdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0} />;
}

function MapStyleOption({
  value,
  label,
  isSelected,
}: {
  value: MapStyle;
  label: string;
  isSelected: boolean;
}) {
  const accentColor = useThemeColor("accent");
  const theme = useUniwind().theme === "light" ? "light" : "dark";

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`${label} map`}
      style={styles.option}
      onPress={() => {
        if (isSelected) return;
        haptics.selection();
        setMapStyle(value);
      }}
    >
      <View style={[styles.previewRing, { borderColor: isSelected ? accentColor : "transparent" }]}>
        <Image source={previews[value][theme]} style={styles.preview} contentFit="cover" />
      </View>
      <Text
        className={
          isSelected
            ? "text-sm font-semibold text-foreground"
            : "text-sm font-medium text-foreground"
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Picks the map style with a preview of each, like Apple Maps' map modes. */
export function MapStyleSheet({
  onClose,
  position,
  getMapFeedbackUrl,
}: {
  /** Called once the sheet has closed. */
  onClose: () => void;
  /** Where the sheet is, for the map controls that sit above it. */
  position: SheetPosition;
  /** "Improve this map" for where the map is now, for the map credits. */
  getMapFeedbackUrl: () => string;
}) {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const [surfaceColor, mutedColor] = useThemeColor(["surface", "muted"]);
  const mapStyle = useMapStyle();

  // Android back closes the sheet instead of leaving the app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      sheetRef.current?.close();
      return true;
    });
    return () => subscription.remove();
  }, []);

  return (
    <BottomSheet
      ref={sheetRef}
      // Mounted open, since calls made before the sheet has measured itself are dropped.
      index={0}
      animatedIndex={position.animatedIndex}
      animatedPosition={position.animatedPosition}
      enableOverDrag={false}
      enablePanDownToClose
      backdropComponent={Backdrop}
      backgroundStyle={{ backgroundColor: surfaceColor, borderRadius: 24 }}
      handleIndicatorStyle={{ backgroundColor: mutedColor }}
      onClose={onClose}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + 16 }]}>
        {/* Centered on the sheet like Apple Maps' map modes, with the close button on top. */}
        <View className="flex-row items-center justify-end">
          <View pointerEvents="none" style={styles.title}>
            <Text accessibilityRole="header" className="text-xl font-semibold text-foreground">
              Map style
            </Text>
          </View>
          <CloseButton accessibilityLabel="Close map" onPress={() => sheetRef.current?.close()} />
        </View>
        <View accessibilityRole="radiogroup" className="mt-4 flex-row gap-3">
          {options.map(({ value, label }) => (
            <MapStyleOption
              key={value}
              value={value}
              label={label}
              isSelected={mapStyle === value}
            />
          ))}
        </View>
        <MapAttribution className="mt-6" getMapFeedbackUrl={getMapFeedbackUrl} />
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16 },
  title: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  option: { flex: 1, alignItems: "center", gap: 8 },
  // The ring sits outside the preview with a gap, like a selected Apple Maps mode.
  previewRing: {
    alignSelf: "stretch",
    padding: 2,
    borderWidth: selectedBorderWidth,
    borderRadius: 16 + 2 + selectedBorderWidth,
    borderCurve: "continuous",
  },
  preview: { aspectRatio: 4 / 3, borderRadius: 16, borderCurve: "continuous" },
});
