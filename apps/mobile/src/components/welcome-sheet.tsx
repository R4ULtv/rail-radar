import { Image } from "expo-image";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import Bookmark from "lucide-react-native/icons/bookmark";
import Search from "lucide-react-native/icons/search";
import Shield from "lucide-react-native/icons/shield";
import TrainFront from "lucide-react-native/icons/train-front";
import { memo, type ComponentType } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { PageSheetHandle } from "@/components/page-sheet-handle";
import { haptics } from "@/lib/haptics";

const appIcon = require("../../assets/icon.png");

const features: {
  icon: ComponentType<{ size?: number; color?: string }>;
  title: string;
  description: string;
}[] = [
  {
    icon: TrainFront,
    title: "Live departures and arrivals",
    description: "Tap any station on the map to see its trains, updated every 30 seconds.",
  },
  {
    icon: Search,
    title: "Instant search, even offline",
    description: "Every station is stored on your phone, so search works without a connection.",
  },
  {
    icon: Bookmark,
    title: "Your stations, one tap away",
    description: "Save the stations you use to have them ready in the search.",
  },
  {
    icon: Shield,
    title: "Private by design",
    description: "No account needed. If you share your location, it never leaves this device.",
  },
];

const WelcomeContent = memo(function WelcomeContent({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const accentColor = useThemeColor("accent");

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.content}>
      <PageSheetHandle />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Image source={appIcon} style={styles.icon} accessibilityIgnoresInvertColors />
        <Text className="mt-6 text-center text-3xl font-bold text-foreground">
          Welcome to Rail Radar
        </Text>
        <Text className="mt-3 text-center text-base text-muted">
          Thank you for buying the app! It supports Rail Radar&apos;s development and helps keep
          railradar24.com free for everyone.
        </Text>

        <View className="mt-10 gap-7">
          {features.map(({ icon: Icon, title, description }) => (
            <View key={title} className="flex-row items-center gap-4">
              <Icon size={28} color={accentColor} />
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-semibold text-foreground">{title}</Text>
                <Text className="text-sm text-muted">{description}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View className="px-6 pt-3" style={{ paddingBottom: insets.bottom + 16 }}>
        <Button
          size="lg"
          onPress={() => {
            haptics.tap();
            onClose();
          }}
        >
          <Button.Label>Get started</Button.Label>
        </Button>
      </View>
    </SafeAreaView>
  );
});

/**
 * Shown on the first launch, to thank the user and show what the app does: a page sheet on iOS,
 * like the settings, and full screen on Android. Swiping it down closes it too.
 */
export const WelcomeSheet = memo(function WelcomeSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const surfaceColor = useThemeColor("surface");

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {/* Its own provider, since the modal's insets aren't the screen's. */}
      <SafeAreaProvider style={{ backgroundColor: surfaceColor }}>
        <WelcomeContent onClose={onClose} />
      </SafeAreaProvider>
    </Modal>
  );
});

const styles = StyleSheet.create({
  content: { flex: 1 },
  scroll: { paddingHorizontal: 32, paddingTop: 40, paddingBottom: 24 },
  icon: { width: 88, height: 88, borderRadius: 20, alignSelf: "center" },
});
