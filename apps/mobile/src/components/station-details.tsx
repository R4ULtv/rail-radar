import { getCountry } from "@repo/data/countries";
import type { Station } from "@repo/data/types";
import { Image } from "expo-image";
import { useThemeColor } from "heroui-native/hooks";
import { ListGroup } from "heroui-native/list-group";
import { Separator } from "heroui-native/separator";
import { Surface } from "heroui-native/surface";
import BarChart from "lucide-react-native/icons/chart-no-axes-column";
import Bug from "lucide-react-native/icons/bug";
import Images from "lucide-react-native/icons/images";
import Info from "lucide-react-native/icons/info";
import Lightbulb from "lucide-react-native/icons/lightbulb";
import MapPin from "lucide-react-native/icons/map-pin";
import TrendingUp from "lucide-react-native/icons/trending-up";
import { memo, type ReactNode } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { withUniwind } from "uniwind";

import { CountryFlag } from "@/components/country-flag";
import { StationSection } from "@/components/station-list";
import {
  useNearbyStations,
  useStationPhotos,
  useStationStats,
  type StationPhoto,
  type StationStats,
} from "@/hooks/use-station-details";
import { USER_AGENT } from "@/lib/api";
import { formatDistance } from "@/lib/distance";

const photoWidth = 240;
const photoHeight = 135;
const issuesUrl = "https://github.com/R4ULtv/rail-radar/issues/new";
const photoHeaders = { "User-Agent": USER_AGENT };

// expo-image caches the full-size photos and decodes them at the thumbnail's size.
const StyledImage = withUniwind(Image);

function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <View className="mb-2 ml-2 flex-row items-center gap-1.5">
      {icon}
      <Text className="text-sm font-medium text-muted">{children}</Text>
    </View>
  );
}

function photoCredit({ attribution }: StationPhoto) {
  return [attribution?.author, attribution?.license].filter(Boolean).join(" · ");
}

function StationPhotos({ photos, mutedColor }: { photos: StationPhoto[]; mutedColor: string }) {
  if (photos.length === 0) return null;

  return (
    <View className="mt-5">
      <SectionTitle icon={<Images size={14} color={mutedColor} />}>Photos</SectionTitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.photoScroll}
        contentContainerStyle={styles.photoRow}
      >
        {photos.map((photo) => {
          const sourceUrl = photo.attribution?.sourceUrl;
          return (
            <Pressable
              key={photo.key}
              accessibilityRole={sourceUrl ? "link" : "image"}
              accessibilityLabel={photo.alt}
              accessibilityHint={sourceUrl ? "Opens where the photo comes from" : undefined}
              disabled={!sourceUrl}
              style={{ width: photoWidth }}
              onPress={() => {
                if (sourceUrl) void Linking.openURL(sourceUrl);
              }}
            >
              <StyledImage
                source={{ uri: photo.url, headers: photoHeaders }}
                accessibilityIgnoresInvertColors
                cachePolicy="memory-disk"
                contentFit="cover"
                recyclingKey={photo.key}
                transition={150}
                className="rounded-2xl bg-default"
                style={styles.photo}
              />
              <Text className="mt-1 px-1 text-xs text-muted" numberOfLines={1}>
                {photoCredit(photo)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function StationPopularity({
  stats,
  mutedColor,
  successColor,
}: {
  stats: StationStats | null;
  mutedColor: string;
  successColor: string;
}) {
  if (!stats?.station) return null;
  const { station, topStation, comparison } = stats;

  return (
    <View className="mt-5">
      <SectionTitle icon={<BarChart size={14} color={mutedColor} />}>
        Popularity (last 7 days)
      </SectionTitle>
      <Surface variant="secondary" className="gap-3 rounded-3xl p-4">
        {comparison.isTopStation ? (
          <View className="flex-row items-center gap-2">
            <TrendingUp size={16} color={successColor} />
            <Text className="text-sm font-medium text-foreground">#1 trending station</Text>
          </View>
        ) : null}
        <Text className="text-sm text-foreground">
          <Text className="font-semibold">{station.uniqueVisitors.toLocaleString()}</Text> unique
          visitors · {station.visits.toLocaleString()} visits
        </Text>
        {topStation && comparison.percentage !== null && !comparison.isTopStation ? (
          <View className="gap-2">
            <Text className="text-xs text-muted">
              {comparison.percentage.toFixed(1)}% of the visitors of the week's #1,{" "}
              {topStation.stationName}.
            </Text>
            <View className="h-1.5 overflow-hidden rounded-full bg-default">
              <View
                className="h-full rounded-full bg-success"
                style={{ width: `${Math.min(comparison.percentage, 100)}%` }}
              />
            </View>
          </View>
        ) : null}
      </Surface>
    </View>
  );
}

function formatDms(value: number, type: "lat" | "lng") {
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const minutesFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  const hemisphere = type === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";

  return `${degrees}°${String(minutes).padStart(2, "0")}'${seconds.toFixed(1).padStart(4, "0")}"${hemisphere}`;
}

function AboutRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ListGroup.Item>
      <ListGroup.ItemContent>
        <ListGroup.ItemDescription>{label}</ListGroup.ItemDescription>
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix>{children}</ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
}

function StationAbout({ station, mutedColor }: { station: Station; mutedColor: string }) {
  const country = getCountry(station.id, { format: "name" });

  return (
    <View className="mt-5">
      <SectionTitle icon={<Info size={14} color={mutedColor} />}>About</SectionTitle>
      <ListGroup variant="secondary">
        {country ? (
          <AboutRow label="Country">
            <View className="flex-row items-center gap-2">
              <CountryFlag stationId={station.id} />
              <Text className="text-sm text-foreground">{country}</Text>
            </View>
          </AboutRow>
        ) : null}
        {station.geo ? (
          <>
            {country ? <Separator className="mx-4" /> : null}
            <AboutRow label="Coordinates">
              <Text selectable className="text-sm text-foreground" style={styles.tabularNums}>
                {formatDms(station.geo.lat, "lat")} {formatDms(station.geo.lng, "lng")}
              </Text>
            </AboutRow>
          </>
        ) : null}
        <Separator className="mx-4" />
        <AboutRow label="Station ID">
          <Text selectable className="text-sm text-foreground" style={styles.tabularNums}>
            {station.id}
          </Text>
        </AboutRow>
      </ListGroup>
    </View>
  );
}

function ReportLinks({ mutedColor }: { mutedColor: string }) {
  const links = [
    { label: "Report a problem", icon: Bug, url: `${issuesUrl}?template=bug_report.yml` },
    { label: "Feature request", icon: Lightbulb, url: `${issuesUrl}?template=feature_request.yml` },
  ];

  return (
    <View className="mt-8 items-center gap-2 px-4">
      <View className="flex-row items-center">
        {links.map(({ label, icon: Icon, url }, index) => (
          <View key={url} className="flex-row items-center">
            {index > 0 ? <Text className="mx-1.5 text-xs text-muted">·</Text> : null}
            <Pressable
              accessibilityRole="link"
              hitSlop={8}
              className="flex-row items-center gap-1.5"
              onPress={() => void Linking.openURL(url)}
            >
              <Icon size={12} color={mutedColor} />
              <Text className="text-xs text-muted">{label}</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <Text className="text-center text-xs text-muted">
        Rail Radar is free and open source. Reports from users help improve station and live-train
        data.
      </Text>
    </View>
  );
}

interface StationDetailsProps {
  station: Station;
  /** Details are only loaded while the sheet is open. */
  isOpen: boolean;
  stationsUrl: string | null;
  onSelectStation: (station: Station) => void;
}

/** Everything about the station besides its live trains: photos, nearby stations, stats. */
export const StationDetails = memo(function StationDetails({
  station,
  isOpen,
  stationsUrl,
  onSelectStation,
}: StationDetailsProps) {
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);
  const photos = useStationPhotos(station, isOpen);
  const stats = useStationStats(station.id, isOpen);
  const nearbyStations = useNearbyStations(station, stationsUrl);

  return (
    <View className="px-4">
      <StationPhotos photos={photos} mutedColor={mutedColor} />
      <StationSection
        title="Nearby Stations"
        icon={<MapPin size={14} color={mutedColor} />}
        stations={nearbyStations}
        renderSuffix={(nearby) => (
          <Text className="text-xs text-muted" style={styles.tabularNums}>
            {formatDistance(nearby.distance)}
          </Text>
        )}
        onSelect={onSelectStation}
      />
      <StationPopularity stats={stats} mutedColor={mutedColor} successColor={successColor} />
      <StationAbout station={station} mutedColor={mutedColor} />
      <ReportLinks mutedColor={mutedColor} />
    </View>
  );
});

const styles = StyleSheet.create({
  photoScroll: { marginHorizontal: -16 },
  photoRow: { gap: 10, paddingHorizontal: 16 },
  photo: { width: photoWidth, height: photoHeight },
  tabularNums: { fontVariant: ["tabular-nums"] },
});
