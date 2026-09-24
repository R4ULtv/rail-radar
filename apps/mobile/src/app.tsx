import { useThemeColor } from "heroui-native/hooks";
import { HeroUINativeProvider } from "heroui-native/provider";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { MapScreen } from "@/components/map-screen";
import "./global.css";

export default function App() {
  const backgroundColor = useThemeColor("background");

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor }]}>
      <SafeAreaProvider>
        <HeroUINativeProvider>
          <MapScreen />
        </HeroUINativeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
