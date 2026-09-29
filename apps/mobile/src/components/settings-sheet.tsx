import Mapbox from "@rnmapbox/maps";
import { Image } from "expo-image";
import { useThemeColor } from "heroui-native/hooks";
import { ListGroup } from "heroui-native/list-group";
import { Tabs } from "heroui-native/tabs";
import ArrowUpRight from "lucide-react-native/icons/arrow-up-right";
import Bookmark from "lucide-react-native/icons/bookmark";
import BrushCleaning from "lucide-react-native/icons/brush-cleaning";
import Bug from "lucide-react-native/icons/bug";
import ChartNoAxes from "lucide-react-native/icons/chart-no-axes-column";
import Code from "lucide-react-native/icons/code-xml";
import FileText from "lucide-react-native/icons/file-text";
import Globe from "lucide-react-native/icons/globe";
import HardDrive from "lucide-react-native/icons/hard-drive";
import Info from "lucide-react-native/icons/info";
import LifeBuoy from "lucide-react-native/icons/life-buoy";
import Lightbulb from "lucide-react-native/icons/lightbulb";
import Mail from "lucide-react-native/icons/mail";
import MapIcon from "lucide-react-native/icons/map";
import MapPin from "lucide-react-native/icons/map-pin";
import MapPinPen from "lucide-react-native/icons/map-pin-pen";
import MapPinX from "lucide-react-native/icons/map-pin-x";
import Moon from "lucide-react-native/icons/moon";
import Palette from "lucide-react-native/icons/palette";
import History from "lucide-react-native/icons/rotate-ccw-clock";
import Shield from "lucide-react-native/icons/shield";
import Smartphone from "lucide-react-native/icons/smartphone";
import Sun from "lucide-react-native/icons/sun";
import TrainFront from "lucide-react-native/icons/train-front";
import Users from "lucide-react-native/icons/users";
import { Fragment, memo, useCallback, useState, type ComponentType, type ReactNode } from "react";
import { Alert, Linking, Modal, Platform, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { expo } from "../../app.json";
import {
  SettingsButton,
  useSheetBottomInset,
  type LocationStatus,
} from "@/components/map-controls";
import { PageSheetHandle } from "@/components/page-sheet-handle";
import { SheetHeader, SheetHeaderFade, useSheetScrollOffset } from "@/components/sheet-header";
import { RowSeparator, SectionTitle } from "@/components/station-list";
import { resetStations, useStationsDownloadedAt } from "@/hooks/use-stations-url";
import {
  clearRecentStations,
  clearSavedStations,
  useRecentStations,
  useSavedStations,
} from "@/hooks/use-stored-stations";
import { haptics } from "@/lib/haptics";
import {
  bugReportUrl,
  contactUrl,
  featureRequestUrl,
  mapboxPrivacyPolicyUrl,
  mapboxUrl,
  openStreetMapUrl,
  privacyPolicyUrl,
  sourceCodeUrl,
  termsOfServiceUrl,
  websiteUrl,
} from "@/lib/links";
import { setThemePreference, useThemePreference, type ThemePreference } from "@/lib/theme";
import { forgetLastUserLocation, hasLastUserLocation } from "@/lib/user-location";

const appIcon = require("../../assets/icon.png");

type Icon = ComponentType<{ size?: number; color?: string }>;

const themes: { value: ThemePreference; label: string; icon: Icon }[] = [
  { value: "system", label: "System", icon: Smartphone },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const locationLabels: Record<LocationStatus, string> = {
  idle: "Not allowed",
  locating: "Allowed",
  located: "Allowed",
  off: "Off",
};

const cacheStatusLabels = { clearing: "Clearing…", cleared: "Cleared", failed: "Failed" };

const dayMs = 24 * 60 * 60 * 1000;

function formatDownloadAge(downloadedAt: number) {
  const days = Math.floor((Date.now() - downloadedAt) / dayMs);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function Section({
  title,
  icon,
  footer,
  children,
}: {
  title: string;
  icon: ReactNode;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <View className="mt-5">
      <SectionTitle icon={icon}>{title}</SectionTitle>
      {/* Clipped, so a pressed first or last row keeps the rounded corners. */}
      <ListGroup variant="secondary" className="overflow-hidden">
        {children}
      </ListGroup>
      {footer ? <Text className="mt-2 px-4 text-xs text-muted">{footer}</Text> : null}
    </View>
  );
}

function Row({
  icon: Icon,
  title,
  description,
  suffix,
  isDisabled = false,
  isDestructive = false,
  accessibilityRole = "button",
  onPress,
}: {
  icon: Icon;
  title: string;
  description?: string;
  suffix?: ReactNode;
  isDisabled?: boolean;
  /** Red, like the confirmation it asks for. */
  isDestructive?: boolean;
  accessibilityRole?: "button" | "link";
  /** Without it, the row only shows information. */
  onPress?: () => void;
}) {
  const iconColor = useThemeColor(isDestructive ? "danger-foreground" : "accent-foreground");

  return (
    <ListGroup.Item
      accessibilityRole={onPress ? accessibilityRole : undefined}
      // A plain highlight, like the system settings. The animated press feedback the station
      // lists use is slow to mount, and made the settings slow to open.
      className={onPress ? "active:bg-surface-tertiary" : undefined}
      disabled={isDisabled || !onPress}
      style={{ opacity: isDisabled ? 0.5 : 1 }}
      onPress={onPress}
    >
      <ListGroup.ItemPrefix>
        {/* A rounded tile, as big as the station icons in the other lists. */}
        <View
          className={`size-6 items-center justify-center rounded-md ${isDestructive ? "bg-danger" : "bg-accent"}`}
        >
          <Icon size={14} color={iconColor} />
        </View>
      </ListGroup.ItemPrefix>
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle className={isDestructive ? "text-danger" : undefined}>
          {title}
        </ListGroup.ItemTitle>
        {description ? <ListGroup.ItemDescription>{description}</ListGroup.ItemDescription> : null}
      </ListGroup.ItemContent>
      {suffix ? <ListGroup.ItemSuffix>{suffix}</ListGroup.ItemSuffix> : null}
    </ListGroup.Item>
  );
}

/** Marks a row that leaves the app. */
function ExternalIcon() {
  const mutedColor = useThemeColor("muted");
  return <ArrowUpRight size={16} color={mutedColor} />;
}

function LinkRows({
  links,
}: {
  links: { icon: Icon; title: string; description?: string; url: string }[];
}) {
  return links.map(({ icon, title, description, url }, index) => (
    <Fragment key={url}>
      {index > 0 ? <RowSeparator /> : null}
      <Row
        icon={icon}
        title={title}
        description={description}
        accessibilityRole="link"
        suffix={<ExternalIcon />}
        onPress={() => void Linking.openURL(url)}
      />
    </Fragment>
  ));
}

function ThemeTabs() {
  const [foregroundColor, mutedColor] = useThemeColor(["foreground", "muted"]);
  const theme = useThemePreference();

  return (
    <Tabs
      value={theme}
      onValueChange={(value) => {
        haptics.selection();
        setThemePreference(value as ThemePreference);
      }}
      variant="primary"
    >
      <Tabs.List className="w-full">
        <Tabs.Indicator />
        {themes.map(({ value, label, icon: Icon }) => (
          <Tabs.Trigger key={value} value={value} className="flex-1 gap-1.5">
            {({ isSelected }) => (
              <>
                <Icon size={16} color={isSelected ? foregroundColor : mutedColor} />
                <Tabs.Label>{label}</Tabs.Label>
              </>
            )}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs>
  );
}

function Status({ children }: { children: ReactNode }) {
  return (
    <Text className="text-sm text-muted" style={styles.tabularNums}>
      {children}
    </Text>
  );
}

function confirm(title: string, message: string, action: string, onConfirm: () => void) {
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: action, style: "destructive", onPress: onConfirm },
  ]);
}

/** Map tiles and station photos; both are downloaded again when they're next shown. */
async function clearCache() {
  await Promise.all([Mapbox.clearData(), Image.clearDiskCache(), Image.clearMemoryCache()]);
}

function DataRows() {
  const recentStations = useRecentStations();
  const { savedStations } = useSavedStations();
  const stationsDownloadedAt = useStationsDownloadedAt();
  // Read when the settings open, which mounts this; nothing else changes it meanwhile.
  const [hasLocation, setHasLocation] = useState(hasLastUserLocation);
  const [cacheStatus, setCacheStatus] = useState<"idle" | "clearing" | "cleared" | "failed">(
    "idle",
  );

  return (
    <>
      <Row
        icon={History}
        title="Clear recent stations"
        suffix={recentStations.length > 0 ? <Status>{recentStations.length}</Status> : null}
        isDisabled={recentStations.length === 0}
        isDestructive
        onPress={() =>
          confirm("Clear recent stations?", "Saved stations are kept.", "Clear", () => {
            clearRecentStations();
          })
        }
      />
      <RowSeparator />
      <Row
        icon={Bookmark}
        title="Clear saved stations"
        suffix={savedStations.length > 0 ? <Status>{savedStations.length}</Status> : null}
        isDisabled={savedStations.length === 0}
        isDestructive
        onPress={() =>
          confirm(
            "Clear saved stations?",
            savedStations.length === 1
              ? "Your saved station will be removed."
              : `All ${savedStations.length} saved stations will be removed.`,
            "Clear",
            clearSavedStations,
          )
        }
      />
      <RowSeparator />
      <Row
        icon={MapPinX}
        title="Forget last location"
        description="Kept for a day, so the map opens where you were."
        isDisabled={!hasLocation}
        onPress={() => {
          forgetLastUserLocation();
          setHasLocation(false);
          haptics.tap();
        }}
      />
      <RowSeparator />
      <Row
        icon={TrainFront}
        title="Reset station data"
        description={
          stationsDownloadedAt === null
            ? "Using the stations built into the app."
            : `Updated ${formatDownloadAge(stationsDownloadedAt)}.`
        }
        isDisabled={stationsDownloadedAt === null}
        isDestructive
        onPress={() =>
          confirm(
            "Reset station data?",
            "The map goes back to the stations built into the app. The latest ones are downloaded again the next time you open it.",
            "Reset",
            resetStations,
          )
        }
      />
      <RowSeparator />
      <Row
        icon={BrushCleaning}
        title="Clear cache"
        description="Map tiles and station photos, downloaded again when needed."
        suffix={cacheStatus === "idle" ? null : <Status>{cacheStatusLabels[cacheStatus]}</Status>}
        isDisabled={cacheStatus === "clearing" || cacheStatus === "cleared"}
        onPress={() => {
          setCacheStatus("clearing");
          clearCache().then(
            () => {
              setCacheStatus("cleared");
              haptics.tap();
            },
            () => {
              setCacheStatus("failed");
              haptics.error();
            },
          );
        }}
      />
    </>
  );
}

// Memoized, so closing the settings doesn't render them once more on the way out.
const SettingsContent = memo(function SettingsContent({
  locationStatus,
  getMapFeedbackUrl,
  onClose,
}: {
  locationStatus: LocationStatus;
  getMapFeedbackUrl: () => string;
  onClose: () => void;
}) {
  const bottomInset = useSheetBottomInset();
  const mutedColor = useThemeColor("muted");
  const [scrollRef, scrollOffset] = useSheetScrollOffset();

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.content}>
      <PageSheetHandle />
      {/* Above the list, so it fades out under the header like in the other sheets. */}
      <View style={styles.header}>
        <View className={`px-4 pb-1 ${Platform.OS === "ios" ? "" : "pt-4"}`}>
          <SheetHeader title="Settings" closeLabel="Close settings" onClose={onClose} />
        </View>
        <SheetHeaderFade scrollOffset={scrollOffset} />
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomInset }}
      >
        <View className="mt-5">
          <SectionTitle icon={<Palette size={14} color={mutedColor} />}>Appearance</SectionTitle>
          <ThemeTabs />
        </View>

        <Section
          title="Privacy"
          icon={<Shield size={14} color={mutedColor} />}
          footer="There's no account. Your stations, theme and last location stay on this device. Our servers only count which stations are viewed, using a hashed IP address, and the map is loaded from Mapbox."
        >
          <Row
            icon={MapPin}
            title="Location access"
            description="Only used on this device, to show you on the map and sort stations by distance."
            suffix={
              <View className="flex-row items-center gap-1">
                <Status>{locationLabels[locationStatus]}</Status>
                <ExternalIcon />
              </View>
            }
            onPress={() => void Linking.openSettings()}
          />
          <RowSeparator />
          <LinkRows
            links={[
              {
                icon: Shield,
                title: "Privacy policy",
                description: "What we collect, why, and how to ask us to delete it.",
                url: privacyPolicyUrl,
              },
            ]}
          />
        </Section>

        <Section title="On this device" icon={<HardDrive size={14} color={mutedColor} />}>
          <DataRows />
        </Section>

        <Section title="Support" icon={<LifeBuoy size={14} color={mutedColor} />}>
          <LinkRows
            links={[
              { icon: Bug, title: "Report a problem", url: bugReportUrl },
              { icon: Lightbulb, title: "Request a feature", url: featureRequestUrl },
              { icon: Mail, title: "Contact us", url: contactUrl },
            ]}
          />
        </Section>

        <Section title="Map" icon={<MapIcon size={14} color={mutedColor} />}>
          <LinkRows
            links={[
              {
                icon: MapIcon,
                title: "© Mapbox",
                description: "Map design and map tiles.",
                url: mapboxUrl,
              },
              {
                icon: Users,
                title: "© OpenStreetMap",
                description:
                  "Map data by OpenStreetMap contributors, under the Open Database License.",
                url: openStreetMapUrl,
              },
              {
                icon: MapPinPen,
                title: "Improve this map",
                description: "Report a mistake in the map where you're looking.",
                url: getMapFeedbackUrl(),
              },
              {
                icon: Shield,
                title: "Mapbox privacy policy",
                description: "How Mapbox handles the requests made to load the map.",
                url: mapboxPrivacyPolicyUrl,
              },
            ]}
          />
          <RowSeparator />
          <Row
            icon={ChartNoAxes}
            title="Mapbox telemetry"
            description="Anonymous usage reports to Mapbox. Always off in Rail Radar."
            suffix={<Status>Off</Status>}
          />
        </Section>

        <Section title="About" icon={<Info size={14} color={mutedColor} />}>
          <LinkRows
            links={[
              { icon: Globe, title: "Website", url: websiteUrl },
              { icon: FileText, title: "Terms of service", url: termsOfServiceUrl },
              { icon: Code, title: "Source code", url: sourceCodeUrl },
            ]}
          />
        </Section>

        <View className="mt-8 items-center gap-2">
          <Image source={appIcon} style={styles.appIcon} accessibilityIgnoresInvertColors />
          <View className="items-center gap-0.5">
            <Text className="text-sm font-semibold text-foreground">Rail Radar</Text>
            <Text className="text-xs text-muted" style={styles.tabularNums}>
              Version {expo.version} · Free and open source
            </Text>
          </View>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
});

/**
 * The settings button and the settings it opens: a page sheet on iOS, which can be swiped down
 * to close, and full screen on Android. It keeps whether they're open itself, so opening and
 * closing them doesn't re-render the map screen.
 */
export const Settings = memo(function Settings({
  locationStatus,
  getMapFeedbackUrl,
}: {
  /** Shown on the location access row, which opens the system settings to change it. */
  locationStatus: LocationStatus;
  /** "Improve this map" for where the map is now, read when the settings open. */
  getMapFeedbackUrl: () => string;
}) {
  const surfaceColor = useThemeColor("surface");
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => {
    haptics.tap();
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <SettingsButton onPress={open} />
      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={close}
      >
        {/* Its own provider, since the modal's insets aren't the screen's. */}
        <SafeAreaProvider style={{ backgroundColor: surfaceColor }}>
          <SettingsContent
            locationStatus={locationStatus}
            getMapFeedbackUrl={getMapFeedbackUrl}
            onClose={close}
          />
        </SafeAreaProvider>
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  content: { flex: 1 },
  header: { zIndex: 1 },
  appIcon: { width: 48, height: 48, borderRadius: 12 },
  tabularNums: { fontVariant: ["tabular-nums"] },
});
