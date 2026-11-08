import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { useThemeColor } from "heroui-native/hooks";
import { ListGroup } from "heroui-native/list-group";
import { Switch } from "heroui-native/switch";
import { useEffect, useRef } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { useUniwind } from "uniwind";

import { MapAttribution } from "@/components/map-attribution";
import { useSheetBottomInset, type SheetPosition } from "@/components/map-controls";
import { sheetBackgroundStyle, SheetHeader } from "@/components/sheet-header";
import { haptics } from "@/lib/haptics";
import { setPreference, usePreference, type MapStyle } from "@/lib/preferences";

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
        setPreference("mapStyle", value);
      }}
    >
      <View style={[styles.previewRing, { borderColor: isSelected ? accentColor : "transparent" }]}>
        <Image
          source={previews[value][theme]}
          style={styles.preview}
          contentFit="cover"
          // Android resource IDs can change after an update; old disk entries may show another
          // preview. These images already ship with the app, so only cache them in memory.
          cachePolicy="memory"
        />
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

/** Every metro and light rail line on the map. Off at first, since it's busy. */
function TransitLinesRow() {
  const isSelected = usePreference("showTransitLines");
  // The switch's own off color is the row's, so it would show only its thumb.
  const [offColor, accentColor] = useThemeColor(["surface-tertiary", "accent"]);
  const toggle = (next: boolean) => {
    haptics.selection();
    setPreference("showTransitLines", next);
  };

  return (
    <ListGroup variant="secondary">
      <ListGroup.Item
        accessibilityRole="switch"
        accessibilityState={{ checked: isSelected }}
        className="active:bg-surface-tertiary"
        onPress={() => toggle(!isSelected)}
      >
        <ListGroup.ItemContent>
          <ListGroup.ItemTitle>Metro & light rail</ListGroup.ItemTitle>
          <ListGroup.ItemDescription>Show every line when zoomed in</ListGroup.ItemDescription>
        </ListGroup.ItemContent>
        <ListGroup.ItemSuffix>
          {/* The row is the switch for screen readers. */}
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Switch
              isSelected={isSelected}
              onSelectedChange={toggle}
              animation={{ backgroundColor: { value: [offColor, accentColor] } }}
            />
          </View>
        </ListGroup.ItemSuffix>
      </ListGroup.Item>
    </ListGroup>
  );
}

/** Picks the map style with a preview of each, like Apple Maps' map modes, and which lines show. */
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
  const bottomInset = useSheetBottomInset();
  const sheetRef = useRef<BottomSheet>(null);
  const [surfaceColor, mutedColor] = useThemeColor(["surface", "muted"]);
  const mapStyle = usePreference("mapStyle");

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
      accessible={false}
      ref={sheetRef}
      // Mounted open, since calls made before the sheet has measured itself are dropped.
      index={0}
      animatedIndex={position.animatedIndex}
      animatedPosition={position.animatedPosition}
      enableOverDrag={false}
      enablePanDownToClose
      backdropComponent={Backdrop}
      backgroundStyle={[sheetBackgroundStyle, { backgroundColor: surfaceColor }]}
      handleIndicatorStyle={{ backgroundColor: mutedColor }}
      onClose={onClose}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: bottomInset }]}>
        <SheetHeader
          title="Map style"
          closeLabel="Close map style"
          onClose={() => sheetRef.current?.close()}
        />
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
        <View className="mt-6">
          <TransitLinesRow />
        </View>
        <MapAttribution className="mt-8" getMapFeedbackUrl={getMapFeedbackUrl} />
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16 },
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
