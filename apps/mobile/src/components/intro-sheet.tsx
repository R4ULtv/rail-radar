import { Image } from "expo-image";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import Bookmark from "lucide-react-native/icons/bookmark";
import MapPin from "lucide-react-native/icons/map-pin";
import Palette from "lucide-react-native/icons/palette";
import WifiOff from "lucide-react-native/icons/wifi-off";
import { memo, useCallback, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { useSheetBottomInset } from "@/components/map-controls";
import { PageSheetHandle } from "@/components/page-sheet-handle";
import { markReleasesSeen, unseenReleases, type Feature, type Release } from "@/lib/changelog";
import { haptics } from "@/lib/haptics";
import { getPreference, setPreference } from "@/lib/preferences";

const appIcon = require("../../assets/icon.png");

// Only what the app adds to the website, which has the live boards too.
const welcomeFeatures: Feature[] = [
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

type IntroPage = "welcome" | "changelog";

const markPageSeen = (page: IntroPage) =>
  page === "welcome" ? setPreference("welcomeSeen", true) : markReleasesSeen();

/**
 * The welcome on the first launch, then what's new in this version. Each page is shown once,
 * read before the first render so the sheet opens with the app.
 */
export function useIntro() {
  const [releases] = useState(unseenReleases);
  const [pages, setPages] = useState<IntroPage[]>(() => [
    ...(getPreference("welcomeSeen") ? [] : ["welcome" as const]),
    ...(releases.length > 0 ? ["changelog" as const] : []),
  ]);

  const next = useCallback(() => {
    const [page, ...rest] = pages;
    if (!page) return;
    markPageSeen(page);
    setPages(rest);
  }, [pages]);

  // Swiping the sheet away skips the pages after this one too.
  const close = useCallback(() => {
    pages.forEach(markPageSeen);
    setPages([]);
  }, [pages]);

  return { page: pages[0] ?? null, hasNextPage: pages.length > 1, releases, next, close };
}

function FeatureList({ features }: { features: Feature[] }) {
  const accentColor = useThemeColor("accent");

  return (
    <View className="gap-5">
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
  );
}

function WelcomePage() {
  return (
    <>
      <Text className="mt-5 text-center text-2xl font-bold text-foreground">
        Thanks for testing Rail Radar
      </Text>
      <Text className="mt-2 text-center text-base text-muted">
        You&apos;re one of the first to try the app. Here&apos;s what it adds to railradar24.com.
      </Text>
      <View className="mt-8">
        <FeatureList features={welcomeFeatures} />
      </View>
      <Text className="mt-8 text-center text-sm text-muted">
        And there&apos;s more on the way before version 1.0.
      </Text>
    </>
  );
}

function ChangelogPage({ releases }: { releases: Release[] }) {
  const [latest] = releases;
  if (!latest) return null;

  return (
    <>
      <Text className="mt-5 text-center text-2xl font-bold text-foreground">What&apos;s new</Text>
      <Text className="mt-2 text-center text-base text-muted">
        {releases.length === 1
          ? `In version ${latest.version}`
          : "Since the last version you opened"}
      </Text>
      {releases.map(({ version, features }) => (
        <View key={version} className="mt-8 gap-4">
          {releases.length > 1 ? (
            <Text className="text-sm font-semibold text-muted">Version {version}</Text>
          ) : null}
          <FeatureList features={features} />
        </View>
      ))}
    </>
  );
}

const IntroContent = memo(function IntroContent({
  page,
  hasNextPage,
  releases,
  onNext,
}: {
  page: IntroPage;
  hasNextPage: boolean;
  releases: Release[];
  onNext: () => void;
}) {
  const bottomInset = useSheetBottomInset();

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.content}>
      <PageSheetHandle />
      {/* Fits on the screen; it only scrolls with very large text or many releases. */}
      <ScrollView contentContainerStyle={styles.scroll}>
        <Image source={appIcon} style={styles.icon} accessibilityIgnoresInvertColors />
        {/* Keyed, so the next page fades in. */}
        <Animated.View key={page} entering={FadeIn.duration(250)}>
          {page === "welcome" ? <WelcomePage /> : <ChangelogPage releases={releases} />}
        </Animated.View>
      </ScrollView>

      <View className="px-6 pt-3" style={{ paddingBottom: bottomInset }}>
        <Button
          size="lg"
          onPress={() => {
            haptics.tap();
            onNext();
          }}
        >
          <Button.Label>
            {hasNextPage ? "Continue" : page === "welcome" ? "Get started" : "Done"}
          </Button.Label>
        </Button>
      </View>
    </SafeAreaView>
  );
});

/**
 * The welcome and what's new: a page sheet on iOS, like the settings, and full screen on
 * Android. Swiping it down closes it too.
 */
export const IntroSheet = memo(function IntroSheet({
  intro,
}: {
  intro: ReturnType<typeof useIntro>;
}) {
  const surfaceColor = useThemeColor("surface");
  const { page, hasNextPage, releases, next, close } = intro;
  // The last page stays while the sheet slides away.
  const [shownPage, setShownPage] = useState(page);
  if (page && page !== shownPage) setShownPage(page);

  return (
    <Modal
      visible={page !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      {/* Its own provider, since the modal's insets aren't the screen's. */}
      <SafeAreaProvider style={{ backgroundColor: surfaceColor }}>
        {shownPage ? (
          <IntroContent
            page={shownPage}
            hasNextPage={hasNextPage}
            releases={releases}
            onNext={next}
          />
        ) : null}
      </SafeAreaProvider>
    </Modal>
  );
});

const styles = StyleSheet.create({
  content: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 32, paddingVertical: 24 },
  icon: { width: 64, height: 64, borderRadius: 15, alignSelf: "center" },
});
