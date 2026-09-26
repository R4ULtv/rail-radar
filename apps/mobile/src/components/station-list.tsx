import type { Station } from "@repo/data/types";
import { useThemeColor } from "heroui-native/hooks";
import { ListGroup } from "heroui-native/list-group";
import { Separator } from "heroui-native/separator";
import { Skeleton } from "heroui-native/skeleton";
import { Fragment, memo, type ComponentType, type ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { CountryFlag } from "@/components/country-flag";
import { stationIcons } from "@/lib/station-icons";

/** A Lucide icon, drawn at the section title's size and color. */
export type SectionIcon = ComponentType<{ size?: number; color?: string }>;

export function StationTypeIcon({ type }: { type: Station["type"] }) {
  return <Image source={stationIcons[type]} style={styles.stationIcon} />;
}

export function SectionTitle({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <View className="mb-2 ml-2 flex-row items-center gap-1.5">
      {icon}
      <Text className="text-sm font-medium text-muted">{children}</Text>
    </View>
  );
}

interface StationRowProps<T extends Station> {
  station: T;
  renderSuffix?: (station: T) => ReactNode;
  onSelect: (station: Station) => void;
}

function StationRowContent<T extends Station>({
  station,
  renderSuffix,
  onSelect,
}: StationRowProps<T>) {
  return (
    <ListGroup.Item
      accessibilityRole="button"
      // A plain highlight, like the settings rows. The animated press feedback is slow to mount,
      // and the search mounts new rows as you type.
      className="active:bg-surface-tertiary"
      onPress={() => onSelect(station)}
    >
      <ListGroup.ItemPrefix>
        <StationTypeIcon type={station.type} />
      </ListGroup.ItemPrefix>
      <ListGroup.ItemContent>
        <View className="flex-row items-center gap-2">
          <ListGroup.ItemTitle numberOfLines={1} className="shrink">
            {station.name}
          </ListGroup.ItemTitle>
          <CountryFlag stationId={station.id} />
        </View>
      </ListGroup.ItemContent>
      {renderSuffix ? <ListGroup.ItemSuffix>{renderSuffix(station)}</ListGroup.ItemSuffix> : null}
    </ListGroup.Item>
  );
}

// Memoized, so a station that stays in the search results as you type isn't rendered again.
const StationRow = memo(StationRowContent) as typeof StationRowContent;

function StationSectionTitle({ icon: Icon, title }: { icon: SectionIcon; title: string }) {
  const mutedColor = useThemeColor("muted");
  return <SectionTitle icon={<Icon size={14} color={mutedColor} />}>{title}</SectionTitle>;
}

function StationSectionContent<T extends Station>({
  title,
  icon,
  stations,
  renderSuffix,
  onSelect,
}: {
  title: string;
  icon: SectionIcon;
  stations: T[];
  /** Shown on the right of each row, e.g. visitor counts or the distance. */
  renderSuffix?: (station: T) => ReactNode;
  onSelect: (station: Station) => void;
}) {
  if (stations.length === 0) return null;

  return (
    <View className="mt-5">
      <StationSectionTitle icon={icon} title={title} />
      {/* Clipped, so a pressed first or last row keeps the rounded corners. */}
      <ListGroup variant="secondary" className="overflow-hidden">
        {stations.map((station, index) => (
          <Fragment key={station.id}>
            {index > 0 ? <Separator className="mx-4" /> : null}
            <StationRow station={station} renderSuffix={renderSuffix} onSelect={onSelect} />
          </Fragment>
        ))}
      </ListGroup>
    </View>
  );
}

/** Memoized: pass stable `stations`, `renderSuffix` and `onSelect` so it only renders when they change. */
export const StationSection = memo(StationSectionContent) as typeof StationSectionContent;

// The same widths as the web's search skeleton.
const skeletonNameClassNames = [
  "h-3.5 w-40 rounded-full",
  "h-3.5 w-28 rounded-full",
  "h-3.5 w-36 rounded-full",
  "h-3.5 w-24 rounded-full",
  "h-3.5 w-32 rounded-full",
];

/** A station section while its stations load, like the web's search skeleton. */
export function StationSectionSkeleton({ title, icon }: { title: string; icon: SectionIcon }) {
  return (
    <View className="mt-5" accessibilityLabel="Loading stations">
      <StationSectionTitle icon={icon} title={title} />
      <ListGroup variant="secondary" importantForAccessibility="no-hide-descendants">
        {skeletonNameClassNames.map((className, index) => (
          <Fragment key={className}>
            {index > 0 ? <Separator className="mx-4" /> : null}
            <ListGroup.Item disabled>
              <ListGroup.ItemPrefix>
                <Skeleton className="size-6 rounded-md" />
              </ListGroup.ItemPrefix>
              <ListGroup.ItemContent>
                <View className="flex-row items-center gap-2">
                  <Skeleton className={className} />
                  <Skeleton className="size-3.5 rounded-full" />
                </View>
              </ListGroup.ItemContent>
            </ListGroup.Item>
          </Fragment>
        ))}
      </ListGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  stationIcon: { width: 24, height: 24 },
});
