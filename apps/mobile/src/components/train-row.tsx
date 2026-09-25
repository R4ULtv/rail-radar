import type { Train } from "@repo/data/types";
import { useThemeColor } from "heroui-native/hooks";
import { Skeleton } from "heroui-native/skeleton";
import ArrowDown from "lucide-react-native/icons/arrow-down";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import Ban from "lucide-react-native/icons/ban";
import type { LayoutChangeEvent } from "react-native";
import { StyleSheet, Text, View } from "react-native";

import { BrandLogo } from "@/components/brand-logo";
import type { BoardType } from "@/hooks/use-station-board";

const statusLabels = { departing: "Departing", incoming: "Incoming", cancelled: "Cancelled" };
const statusClassNames = {
  departing: "text-accent",
  incoming: "text-success",
  cancelled: "text-danger",
};
const statusBarClassNames = {
  departing: "bg-accent",
  incoming: "bg-success",
  cancelled: "bg-danger",
};

function TrainStatus({ status }: { status: NonNullable<Train["status"]> }) {
  const [accentColor, successColor, dangerColor] = useThemeColor(["accent", "success", "danger"]);
  const Icon = { departing: ArrowRight, incoming: ArrowDown, cancelled: Ban }[status];
  const color = { departing: accentColor, incoming: successColor, cancelled: dangerColor }[status];

  return (
    <View className="shrink-0 flex-row items-center gap-1">
      <Icon size={12} color={color} strokeWidth={2.5} />
      <Text className={`text-xs font-medium ${statusClassNames[status]}`}>
        {statusLabels[status]}
      </Text>
    </View>
  );
}

interface TrainRowProps {
  train: Train;
  type: BoardType;
  onLayout?: (event: LayoutChangeEvent) => void;
}

export function TrainRow({ train, type, onLayout }: TrainRowProps) {
  const route = type === "arrivals" ? train.origin : train.destination;
  const hasDelay = train.delay !== null && train.delay > 0;
  const isCancelled = train.status === "cancelled";
  const platform = train.platform ?? "–";

  return (
    <View
      className="flex-row gap-3 border-b border-separator px-4 py-3"
      accessible
      onLayout={onLayout}
    >
      {train.status ? (
        <View className={statusBarClassNames[train.status]} style={styles.statusBar} />
      ) : null}
      <View
        className="h-12 min-w-12 items-center justify-center rounded-2xl bg-default px-2"
        accessibilityLabel={train.platform ? `Platform ${train.platform}` : "Platform unknown"}
      >
        <Text
          className={`font-bold text-foreground ${platform.length > 2 ? "text-sm" : "text-xl"}`}
          numberOfLines={1}
        >
          {platform}
        </Text>
      </View>

      <View style={styles.details}>
        <View className="flex-row items-center justify-between gap-2">
          <View className="shrink flex-row items-center gap-1.5">
            <BrandLogo brand={train.brand} />
            {train.category ? (
              <View className="rounded-full bg-default px-1.5 py-0.5">
                <Text className="text-xs font-medium text-muted" numberOfLines={1}>
                  {train.category}
                </Text>
              </View>
            ) : null}
            <Text className="shrink font-medium text-foreground" numberOfLines={1}>
              {train.trainNumber}
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Text
              className={`font-semibold ${isCancelled ? "text-muted line-through" : "text-foreground"}`}
              style={styles.tabularNums}
            >
              {train.scheduledTime}
            </Text>
            {hasDelay ? (
              <Text className="text-xs font-medium text-danger" style={styles.tabularNums}>
                +{train.delay} min
              </Text>
            ) : null}
          </View>
        </View>

        <View className="mt-1 flex-row items-center justify-between gap-2">
          <Text className="flex-1 text-sm text-muted" numberOfLines={1}>
            {route ? `${type === "arrivals" ? "From" : "To"} ${route}` : "–"}
          </Text>
          {train.status ? <TrainStatus status={train.status} /> : null}
        </View>

        {train.info ? (
          <Text className="mt-1 text-xs text-muted" numberOfLines={2}>
            {train.info}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function TrainRowSkeleton({ onLayout }: { onLayout?: (event: LayoutChangeEvent) => void }) {
  return (
    <View className="flex-row gap-3 border-b border-separator px-4 py-3" onLayout={onLayout}>
      <Skeleton className="h-12 w-12 rounded-2xl" />
      <View style={styles.details} className="justify-center gap-2">
        <View className="flex-row justify-between">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-4 w-12 rounded-md" />
        </View>
        <Skeleton className="h-3.5 w-40 rounded-md" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  details: { flex: 1, minWidth: 0 },
  statusBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  tabularNums: { fontVariant: ["tabular-nums"] },
});
