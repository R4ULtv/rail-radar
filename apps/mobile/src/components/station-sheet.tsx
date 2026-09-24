import { getCountry } from "@repo/data/countries";
import type { Station, Train } from "@repo/data/types";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { Button } from "heroui-native/button";
import { useThemeColor } from "heroui-native/hooks";
import Bookmark from "lucide-react-native/icons/bookmark";
import ExternalLink from "lucide-react-native/icons/external-link";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import X from "lucide-react-native/icons/x";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useStationBoard, type BoardType } from "@/hooks/use-station-board";
import { MAX_SAVED_STATIONS, useSavedStations } from "@/hooks/use-stored-stations";

interface StationSheetProps {
  station: Station;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

function TrainRow({ train, type }: { train: Train; type: BoardType }) {
  const route = type === "departures" ? train.destination : train.origin;
  const hasDelay = train.delay !== null && train.delay > 0;

  return (
    <View className="flex-row gap-3 border-b border-separator py-3">
      <View className="h-13 w-13 items-center justify-center rounded-2xl bg-default">
        <Text className="text-[10px] font-medium uppercase text-muted">Plat.</Text>
        <Text className="text-lg font-bold text-foreground" numberOfLines={1}>
          {train.platform ?? "–"}
        </Text>
      </View>
      <View style={styles.trainDetails}>
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 font-semibold text-foreground" numberOfLines={1}>
            {[train.brand ?? train.category, train.trainNumber].filter(Boolean).join(" ")}
          </Text>
          <Text className="font-semibold tabular-nums text-foreground">{train.scheduledTime}</Text>
        </View>
        <Text className="mt-1 text-sm text-muted" numberOfLines={1}>
          {route
            ? `${type === "departures" ? "To" : "From"} ${route}`
            : `${type === "departures" ? "Destination" : "Origin"} unavailable`}
        </Text>
        {hasDelay || train.status ? (
          <View className="mt-1 flex-row gap-2">
            {hasDelay ? (
              <Text className="text-xs font-medium text-danger">+{train.delay} min</Text>
            ) : null}
            {train.status ? (
              <Text
                className={
                  train.status === "cancelled"
                    ? "text-xs font-medium capitalize text-danger"
                    : "text-xs font-medium capitalize text-accent"
                }
              >
                {train.status}
              </Text>
            ) : null}
          </View>
        ) : null}
        {train.info ? (
          <Text className="mt-1 text-xs text-muted" numberOfLines={2}>
            {train.info}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function StationSheet({ station, isOpen, onOpenChange }: StationSheetProps) {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheet>(null);
  const [type, setType] = useState<BoardType>("departures");
  const [foregroundColor, accentColor, surfaceColor] = useThemeColor([
    "default-foreground",
    "accent",
    "surface",
  ]);
  const { isSaved, isFull, toggleSaved } = useSavedStations();
  const saved = isSaved(station.id);
  const isRail = station.type === "rail";
  const arrivalsSupported = getCountry(station.id) !== "lu";
  const { data, error, isLoading, isRefreshing, retry } = useStationBoard(
    station.id,
    type,
    isOpen && isRail,
  );

  useEffect(() => {
    if (isOpen) sheetRef.current?.snapToIndex(0);
    else sheetRef.current?.close();
  }, [isOpen]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={["64%"]}
      enableDynamicSizing={false}
      enableOverDrag={false}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: surfaceColor, borderRadius: 24 }}
      handleIndicatorStyle={{ backgroundColor: accentColor }}
      onClose={() => {
        if (isOpen) onOpenChange(false);
      }}
    >
      <View style={styles.content}>
        <View className="flex-row items-start justify-between gap-3">
          <View style={styles.headingText}>
            <Text className="text-xs font-semibold uppercase tracking-wider text-muted">
              {station.type} station · {isRail ? "Live board" : "Station details"}
            </Text>
            <Text className="mt-1 text-2xl font-semibold text-foreground" numberOfLines={2}>
              {station.name}
            </Text>
          </View>
          <View className="flex-row gap-1">
            <Button
              accessibilityLabel={
                saved
                  ? "Remove from saved stations"
                  : isFull
                    ? `Maximum ${MAX_SAVED_STATIONS} saved stations reached`
                    : "Save station"
              }
              accessibilityState={{ selected: saved }}
              isDisabled={!station.geo || (!saved && isFull)}
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => toggleSaved(station)}
            >
              <Bookmark
                size={18}
                color={saved ? accentColor : foregroundColor}
                fill={saved ? accentColor : "none"}
              />
            </Button>
            <Button
              accessibilityLabel="Open station page"
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() =>
                void Linking.openURL(
                  `https://www.railradar24.com/station/${encodeURIComponent(station.id)}`,
                )
              }
            >
              <ExternalLink size={18} color={foregroundColor} />
            </Button>
            <Button
              accessibilityLabel="Close station details"
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => onOpenChange(false)}
            >
              <X size={18} color={foregroundColor} />
            </Button>
          </View>
        </View>

        {!isRail ? (
          <View style={styles.centeredState}>
            <Text className="text-center text-base text-muted">
              Live boards are available for rail stations only.
            </Text>
          </View>
        ) : (
          <View style={styles.board}>
            {arrivalsSupported ? (
              <View className="mt-5 flex-row gap-2">
                <Button
                  accessibilityRole="tab"
                  accessibilityState={{ selected: type === "departures" }}
                  className="flex-1"
                  size="sm"
                  variant={type === "departures" ? "primary" : "secondary"}
                  onPress={() => setType("departures")}
                >
                  Departures
                </Button>
                <Button
                  accessibilityRole="tab"
                  accessibilityState={{ selected: type === "arrivals" }}
                  className="flex-1"
                  size="sm"
                  variant={type === "arrivals" ? "primary" : "secondary"}
                  onPress={() => setType("arrivals")}
                >
                  Arrivals
                </Button>
              </View>
            ) : (
              <Text className="mt-5 text-sm text-muted">
                Departures · Live arrivals are unavailable in Luxembourg
              </Text>
            )}

            <View className="mt-4 flex-row items-center justify-between">
              <Text className="text-xs text-muted">
                {data?.timestamp
                  ? `Updated ${new Date(data.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`
                  : "Live station data"}
              </Text>
              {isRefreshing ? <ActivityIndicator size="small" color={accentColor} /> : null}
            </View>

            <BottomSheetScrollView
              style={styles.scroll}
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            >
              {error ? (
                <View className="mt-3 rounded-2xl bg-danger-soft p-4">
                  <Text className="text-sm text-danger-soft-foreground">{error}</Text>
                  <Button className="mt-3 self-start" size="sm" variant="secondary" onPress={retry}>
                    <RefreshCw size={15} color={foregroundColor} />
                    <Button.Label>Retry</Button.Label>
                  </Button>
                </View>
              ) : null}

              {isLoading && !data ? (
                <View style={styles.centeredState}>
                  <ActivityIndicator color={accentColor} />
                  <Text className="mt-3 text-sm text-muted">Loading live trains…</Text>
                </View>
              ) : null}

              {data?.info ? (
                <View className="mt-3 rounded-2xl bg-default p-3">
                  <Text className="text-xs leading-5 text-muted">{data.info}</Text>
                </View>
              ) : null}

              {data?.trains.length === 0 ? (
                <View style={styles.centeredState}>
                  <Text className="text-center text-sm text-muted">
                    No {type} are listed right now.
                  </Text>
                </View>
              ) : null}

              {data?.trains.map((train, index) => (
                <TrainRow
                  key={`${train.trainNumber}-${train.scheduledTime}-${train.platform ?? ""}-${index}`}
                  train={train}
                  type={type}
                />
              ))}
            </BottomSheetScrollView>
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  headingText: { flex: 1 },
  board: { flex: 1 },
  scroll: { flex: 1 },
  centeredState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  trainDetails: { flex: 1, minWidth: 0 },
});
