import type { Train } from "@repo/data/types";
import { useThemeColor } from "heroui-native/hooks";
import { Skeleton } from "heroui-native/skeleton";
import ArrowDown from "lucide-react-native/icons/arrow-down";
import ArrowRight from "lucide-react-native/icons/arrow-right";
import Ban from "lucide-react-native/icons/ban";
import Info from "lucide-react-native/icons/info";
import { PressableFeedback } from "heroui-native/pressable-feedback";
import { Separator } from "heroui-native/separator";
import { memo } from "react";
import type { LayoutChangeEvent } from "react-native";
import { StyleSheet, Text, View } from "react-native";

import { BrandLogo } from "@/components/brand-logo";
import type { BoardType } from "@/hooks/use-station-board";
import { haptics } from "@/lib/haptics";

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

type TrainStatusType = keyof typeof statusLabels;

/** Null for a status this version doesn't know, so a new one from the API is left out. */
function knownStatus(status: string | null): TrainStatusType | null {
  return status && Object.prototype.hasOwnProperty.call(statusLabels, status)
    ? (status as TrainStatusType)
    : null;
}

function TrainStatus({ status }: { status: TrainStatusType }) {
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

/** Identifies a train across refreshes, e.g. to keep its info open. */
export function trainKey(train: Train) {
  return `${train.trainNumber}-${train.scheduledTime}`;
}

interface TrainRowProps {
  train: Train;
  type: BoardType;
  /** Whether the train's info is shown; it's hidden until the train is pressed. */
  isExpanded: boolean;
  onToggle: (key: string) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
}

// A record, so a new train field fails to type-check until it's compared too.
const trainFields = Object.keys({
  brand: true,
  category: true,
  trainNumber: true,
  origin: true,
  destination: true,
  scheduledTime: true,
  delay: true,
  platform: true,
  status: true,
  info: true,
} satisfies Record<keyof Train, true>) as (keyof Train)[];

// Every refresh brings new train objects, so rows compare what they show and only the trains
// that changed re-render.
function areRowPropsEqual(previous: TrainRowProps, next: TrainRowProps) {
  return (
    previous.type === next.type &&
    previous.isExpanded === next.isExpanded &&
    previous.onToggle === next.onToggle &&
    previous.onLayout === next.onLayout &&
    trainFields.every((field) => previous.train[field] === next.train[field])
  );
}

export const TrainRow = memo(function TrainRow({
  train,
  type,
  isExpanded,
  onToggle,
  onLayout,
}: TrainRowProps) {
  const mutedColor = useThemeColor("muted");
  const route = type === "arrivals" ? train.origin : train.destination;
  const hasDelay = train.delay !== null && train.delay > 0;
  const status = knownStatus(train.status);
  const isCancelled = status === "cancelled";
  const { platform } = train;

  const row = (
    <View className="flex-row gap-3 px-4 py-3">
      {status ? <View className={statusBarClassNames[status]} style={styles.statusBar} /> : null}
      <View
        className="h-12 min-w-12 items-center justify-center rounded-2xl bg-default px-2"
        accessibilityLabel={platform ? `Platform ${platform}` : "Platform unknown"}
      >
        {platform ? (
          <Text
            className={`font-bold text-foreground ${platform.length > 2 ? "text-sm" : "text-xl"}`}
            numberOfLines={1}
          >
            {platform}
          </Text>
        ) : (
          <Text className="text-base font-medium text-muted">–</Text>
        )}
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
            {train.info ? <Info size={14} color={mutedColor} /> : null}
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
          {status ? <TrainStatus status={status} /> : null}
        </View>

        {train.info && isExpanded ? (
          <Text className="mt-2 text-sm leading-5 text-muted">{train.info}</Text>
        ) : null}
      </View>
    </View>
  );

  if (!train.info) {
    return (
      <View accessible onLayout={onLayout}>
        {row}
      </View>
    );
  }

  return (
    <PressableFeedback
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}
      accessibilityHint={isExpanded ? "Hides the train's info" : "Shows the train's info"}
      animation={false}
      onLayout={onLayout}
      onPress={() => {
        haptics.selection();
        onToggle(trainKey(train));
      }}
    >
      <PressableFeedback.Highlight />
      {row}
    </PressableFeedback>
  );
}, areRowPropsEqual);

/** The line between two rows, inset to the train's details like the lists' separators. */
export function TrainRowSeparator() {
  return <Separator className="mr-4 ml-19" />;
}

export function TrainRowSkeleton({ onLayout }: { onLayout?: (event: LayoutChangeEvent) => void }) {
  return (
    <View className="flex-row gap-3 px-4 py-3" onLayout={onLayout}>
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
  // Beside the platform, as tall as it, rather than along the sheet's edge.
  statusBar: { position: "absolute", left: 6, top: 12, bottom: 12, width: 3, borderRadius: 1.5 },
  tabularNums: { fontVariant: ["tabular-nums"] },
});
