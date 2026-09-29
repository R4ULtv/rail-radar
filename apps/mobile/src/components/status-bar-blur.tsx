import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUniwind } from "uniwind";

// How far below the status bar the blur fades out.
const fadeLength = 20;
const mask = ["#000", "#000", "rgba(0,0,0,0)"] as const;
// Android can't blur the map's GL surface, so it gets a plain scrim in the map's colors.
const scrims = {
  light: ["rgba(255,255,255,0.75)", "rgba(255,255,255,0.75)", "rgba(255,255,255,0)"],
  dark: ["rgba(0,0,0,0.5)", "rgba(0,0,0,0.5)", "rgba(0,0,0,0)"],
} as const;

/**
 * Blurs the map under the status bar and fades out just below it, as Apple Maps does, so the
 * clock and icons stay legible over busy map features.
 */
export function StatusBarBlur() {
  const { top } = useSafeAreaInsets();
  const theme = useUniwind().theme === "light" ? "light" : "dark";
  if (top === 0) return null;

  const height = top + fadeLength;
  // Fully blurred down to the status bar's icons, then fading out.
  const locations = [0, (top * 0.75) / height, 1] as const;
  const style = [styles.container, { height }];

  if (Platform.OS !== "ios") {
    return (
      <LinearGradient
        pointerEvents="none"
        colors={scrims[theme]}
        locations={locations}
        style={style}
      />
    );
  }

  return (
    <MaskedView
      pointerEvents="none"
      style={style}
      maskElement={
        <LinearGradient colors={mask} locations={locations} style={StyleSheet.absoluteFill} />
      }
    >
      <BlurView
        tint={theme === "light" ? "systemUltraThinMaterialLight" : "systemUltraThinMaterialDark"}
        intensity={35}
        style={StyleSheet.absoluteFill}
      />
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  container: { position: "absolute", top: 0, left: 0, right: 0 },
});
