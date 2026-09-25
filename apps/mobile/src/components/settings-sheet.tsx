import { CloseButton } from "heroui-native/close-button";
import { useThemeColor } from "heroui-native/hooks";
import { ListGroup } from "heroui-native/list-group";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { Separator } from "heroui-native/separator";
import { Tabs } from "heroui-native/tabs";
import ArrowUpRight from "lucide-react-native/icons/arrow-up-right";
import Bug from "lucide-react-native/icons/bug";
import Code from "lucide-react-native/icons/code-xml";
import FileText from "lucide-react-native/icons/file-text";
import Globe from "lucide-react-native/icons/globe";
import Info from "lucide-react-native/icons/info";
import LifeBuoy from "lucide-react-native/icons/life-buoy";
import Lightbulb from "lucide-react-native/icons/lightbulb";
import Mail from "lucide-react-native/icons/mail";
import MapPin from "lucide-react-native/icons/map-pin";
import Moon from "lucide-react-native/icons/moon";
import Palette from "lucide-react-native/icons/palette";
import Shield from "lucide-react-native/icons/shield";
import Smartphone from "lucide-react-native/icons/smartphone";
import Sun from "lucide-react-native/icons/sun";
import Trash from "lucide-react-native/icons/trash";
import { Fragment, type ComponentType, type ReactNode } from "react";
import { Alert, Linking, Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { expo } from "../../app.json";
import type { LocationStatus } from "@/components/map-controls";
import { SectionTitle } from "@/components/station-list";
import { clearRecentStations, useRecentStations } from "@/hooks/use-stored-stations";
import { haptics } from "@/lib/haptics";
import {
  bugReportUrl,
  contactUrl,
  featureRequestUrl,
  privacyPolicyUrl,
  sourceCodeUrl,
  termsOfServiceUrl,
  websiteUrl,
} from "@/lib/links";
import { setThemePreference, useThemePreference, type ThemePreference } from "@/lib/theme";

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

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="mt-5">
      <SectionTitle icon={icon}>{title}</SectionTitle>
      <ListGroup variant="secondary">{children}</ListGroup>
    </View>
  );
}

function Row({
  icon: Icon,
  title,
  description,
  suffix,
  isDestructive = false,
  isDisabled = false,
  accessibilityRole = "button",
  onPress,
}: {
  icon: Icon;
  title: string;
  description?: string;
  suffix?: ReactNode;
  isDestructive?: boolean;
  isDisabled?: boolean;
  accessibilityRole?: "button" | "link";
  onPress: () => void;
}) {
  const [foregroundColor, dangerColor] = useThemeColor(["foreground", "danger"]);

  return (
    <PressableFeedback
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: isDisabled }}
      animation={false}
      isDisabled={isDisabled}
      onPress={onPress}
    >
      <PressableFeedback.Scale>
        <ListGroup.Item disabled style={{ opacity: isDisabled ? 0.5 : 1 }}>
          <ListGroup.ItemPrefix>
            <Icon size={20} color={isDestructive ? dangerColor : foregroundColor} />
          </ListGroup.ItemPrefix>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle className={isDestructive ? "text-danger" : undefined}>
              {title}
            </ListGroup.ItemTitle>
            {description ? (
              <ListGroup.ItemDescription>{description}</ListGroup.ItemDescription>
            ) : null}
          </ListGroup.ItemContent>
          {suffix ? <ListGroup.ItemSuffix>{suffix}</ListGroup.ItemSuffix> : null}
        </ListGroup.Item>
      </PressableFeedback.Scale>
      <PressableFeedback.Ripple />
    </PressableFeedback>
  );
}

function LinkRows({ links }: { links: { icon: Icon; title: string; url: string }[] }) {
  const mutedColor = useThemeColor("muted");

  return links.map(({ icon, title, url }, index) => (
    <Fragment key={url}>
      {index > 0 ? <Separator className="mx-4" /> : null}
      <Row
        icon={icon}
        title={title}
        accessibilityRole="link"
        suffix={<ArrowUpRight size={16} color={mutedColor} />}
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

function confirmClearRecentStations() {
  Alert.alert("Clear recent stations?", "Saved stations are kept.", [
    { text: "Cancel", style: "cancel" },
    { text: "Clear", style: "destructive", onPress: clearRecentStations },
  ]);
}

function SettingsContent({
  locationStatus,
  onClose,
}: {
  locationStatus: LocationStatus;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const mutedColor = useThemeColor("muted");
  const recentStations = useRecentStations();

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.content}>
      <View className="flex-row items-center gap-3 px-4 pb-1 pt-4">
        <Text className="flex-1 text-xl font-semibold text-foreground">Settings</Text>
        <CloseButton accessibilityLabel="Close settings" onPress={onClose} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32 }}
      >
        <View className="mt-5">
          <SectionTitle icon={<Palette size={14} color={mutedColor} />}>Appearance</SectionTitle>
          <ThemeTabs />
        </View>

        <Section title="Privacy" icon={<Shield size={14} color={mutedColor} />}>
          <Row
            icon={MapPin}
            title="Location access"
            description="Shows you on the map and ranks nearby stations first."
            suffix={<Text className="text-sm text-muted">{locationLabels[locationStatus]}</Text>}
            onPress={() => void Linking.openSettings()}
          />
          <Separator className="mx-4" />
          <Row
            icon={Trash}
            title="Clear recent stations"
            isDestructive
            isDisabled={recentStations.length === 0}
            onPress={confirmClearRecentStations}
          />
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

        <Section title="About" icon={<Info size={14} color={mutedColor} />}>
          <LinkRows
            links={[
              { icon: Globe, title: "Website", url: websiteUrl },
              { icon: Shield, title: "Privacy policy", url: privacyPolicyUrl },
              { icon: FileText, title: "Terms of service", url: termsOfServiceUrl },
              { icon: Code, title: "Source code", url: sourceCodeUrl },
            ]}
          />
        </Section>

        <Text className="mt-8 text-center text-xs text-muted" style={styles.tabularNums}>
          Rail Radar {expo.version}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

interface SettingsSheetProps {
  isOpen: boolean;
  /** Shown on the location access row, which opens the system settings to change it. */
  locationStatus: LocationStatus;
  onClose: () => void;
}

/** A page sheet on iOS, which can be swiped down to close; full screen on Android. */
export function SettingsSheet({ isOpen, locationStatus, onClose }: SettingsSheetProps) {
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
        <SettingsContent locationStatus={locationStatus} onClose={onClose} />
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  tabularNums: { fontVariant: ["tabular-nums"] },
});
