import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import { HeroUINativeProvider } from "heroui-native/provider";
import Bug from "lucide-react-native/icons/bug";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import Share2 from "lucide-react-native/icons/share-2";
import { Alert, Linking, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/error-boundary";
import { MapScreen } from "@/components/map-screen";
import { createErrorReport, type CapturedError } from "@/lib/error-report";
import { applySavedTheme } from "@/lib/theme";
import "./global.css";

applySavedTheme();

/** Shown instead of the map if it crashes, rather than closing the app. */
function AppError({ onRetry, failure }: { onRetry: () => void; failure: CapturedError }) {
  const [accentForegroundColor, foregroundColor] = useThemeColor([
    "accent-foreground",
    "default-foreground",
  ]);
  const report = createErrorReport(failure);

  return (
    <ScrollView contentContainerStyle={styles.error}>
      <Text className="text-center text-lg font-semibold text-foreground">
        Something went wrong
      </Text>
      <Text className="mt-1 text-center text-sm text-muted">
        Rail Radar ran into a problem. Try again, and if it keeps happening, please report it.
      </Text>
      <View className="mt-6 gap-2 self-stretch">
        <Button variant="primary" onPress={onRetry}>
          <RefreshCw size={16} color={accentForegroundColor} />
          <Button.Label>Try again</Button.Label>
        </Button>
        <Button
          variant="tertiary"
          onPress={() => {
            void Linking.openURL(report.url).catch(() =>
              Alert.alert("Couldn't open the report", "Use Share error details to send the error."),
            );
          }}
        >
          <Bug size={16} color={foregroundColor} />
          <Button.Label>Report a problem</Button.Label>
        </Button>
        <Button
          variant="ghost"
          onPress={() => {
            void Share.share({ title: "Rail Radar error report", message: report.message }).catch(
              () => Alert.alert("Couldn't share the error", "Try Report a problem instead."),
            );
          }}
        >
          <Share2 size={16} color={foregroundColor} />
          <Button.Label>Share error details</Button.Label>
        </Button>
      </View>
    </ScrollView>
  );
}

export default function App() {
  const backgroundColor = useThemeColor("background");

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor }]}>
      <SafeAreaProvider>
        <HeroUINativeProvider>
          <ErrorBoundary
            fallback={(reset, failure) => <AppError onRetry={reset} failure={failure} />}
          >
            <MapScreen />
          </ErrorBoundary>
        </HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  error: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 32 },
});
