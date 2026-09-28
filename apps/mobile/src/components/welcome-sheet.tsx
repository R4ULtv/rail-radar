import { Image } from "expo-image";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import Bookmark from "lucide-react-native/icons/bookmark";
import MapPin from "lucide-react-native/icons/map-pin";
import Palette from "lucide-react-native/icons/palette";
import WifiOff from "lucide-react-native/icons/wifi-off";
import { memo, type ComponentType } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { useSheetBottomInset } from "@/components/map-controls";
import { PageSheetHandle } from "@/components/page-sheet-handle";
import { haptics } from "@/lib/haptics";

const appIcon = require("../../assets/icon.png");

// Only what the app adds to the website, which has the live boards too.
const features: {
  icon: ComponentType<{ size?: number; color?: string }>;
  title: string;
  description: string;
}[] = [
  {
    icon: WifiOff,
    title: "Search without a connection",
    description: "Every station is on your phone, so results show up as you type.",
  },
  {
    icon: MapPin,
    title: "Stations near you first",
    description: "Search puts nearby stations higher and shows how far away they are.",
  },
  {
    icon: Bookmark,
    title: "Save as many stations as you like",
    description: "They stay on your phone and come first in search.",
  },
  {
    icon: Palette,
    title: "A map that suits you",
    description: "Pick a simple or a streets map, in light or dark.",
  },
];

const WelcomeContent = memo(function WelcomeContent({ onClose }: { onClose: () => void }) {
  const bottomInset = useSheetBottomInset();
  const accentColor = useThemeColor("accent");

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.content}>
      <PageSheetHandle />
      {/* Fits on the screen; it only scrolls with very large text. */}
      <ScrollView contentContainerStyle={styles.scroll}>
        <Image source={appIcon} style={styles.icon} accessibilityIgnoresInvertColors />
        <Text className="mt-5 text-center text-2xl font-bold text-foreground">
          Thanks for testing Rail Radar
        </Text>
        <Text className="mt-2 text-center text-base text-muted">
          You&apos;re one of the first to try the app. Here&apos;s what it adds to railradar24.com.
        </Text>

        <View className="mt-8 gap-5">
          {features.map(({ icon: Icon, title, description }) => (
            <View key={title} className="flex-row items-center gap-4">
              <Icon size={24} color={accentColor} />
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-semibold text-foreground">{title}</Text>
                <Text className="text-sm text-muted">{description}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text className="mt-8 text-center text-sm text-muted">
          And there&apos;s more on the way before version 1.0.
        </Text>
      </ScrollView>

      <View className="px-6 pt-3" style={{ paddingBottom: bottomInset }}>
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
 * Shown on the first launch, to thank beta testers and show what the app adds to the website: a
 * page sheet on iOS, like the settings, and full screen on Android. Swiping it down closes it too.
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
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 32, paddingVertical: 24 },
  icon: { width: 64, height: 64, borderRadius: 15, alignSelf: "center" },
});
