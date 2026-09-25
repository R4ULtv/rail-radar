import type { Station } from "@repo/data/types";
import { ListGroup } from "heroui-native/list-group";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { Separator } from "heroui-native/separator";
import { Fragment, type ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { CountryFlag } from "@/components/country-flag";
import { stationIcons } from "@/lib/station-icons";

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

export function StationSection<T extends Station>({
  title,
  icon,
  stations,
  renderSuffix,
  onSelect,
}: {
  title: string;
  icon?: ReactNode;
  stations: T[];
  /** Shown on the right of each row, e.g. visitor counts or the distance. */
  renderSuffix?: (station: T) => ReactNode;
  onSelect: (station: Station) => void;
}) {
  if (stations.length === 0) return null;

  return (
    <View className="mt-5">
      <SectionTitle icon={icon}>{title}</SectionTitle>
      <ListGroup variant="secondary">
        {stations.map((station, index) => (
          <Fragment key={station.id}>
            {index > 0 ? <Separator className="mx-4" /> : null}
            <PressableFeedback
              accessibilityRole="button"
              animation={false}
              onPress={() => onSelect(station)}
            >
              <PressableFeedback.Scale>
                <ListGroup.Item disabled>
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
                  {renderSuffix ? (
                    <ListGroup.ItemSuffix>{renderSuffix(station)}</ListGroup.ItemSuffix>
                  ) : null}
                </ListGroup.Item>
              </PressableFeedback.Scale>
              <PressableFeedback.Ripple />
            </PressableFeedback>
          </Fragment>
        ))}
      </ListGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  stationIcon: { width: 24, height: 24 },
});
