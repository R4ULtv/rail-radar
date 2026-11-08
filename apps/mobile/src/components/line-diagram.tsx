import type { Station } from "@repo/data/types";
import { useThemeColor } from "heroui-native/hooks";
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";
import { useUniwind } from "uniwind";

import {
  LABEL_HEIGHT,
  layoutLineDiagram,
  type DiagramLabel,
  type DiagramStop,
} from "@/lib/line-diagram";
import {
  getLineColor,
  getLineColorOnSheet,
  getLineIconColor,
  getViaStation,
  shortStationName,
  type Line,
} from "@/lib/lines";

// The sheet's padding on either side.
const sheetPadding = 16;

function DiagramText({ label, width }: { label: DiagramLabel; width: number }) {
  const position =
    label.align === "left"
      ? { left: label.x }
      : label.align === "right"
        ? { right: width - label.x }
        : {
            left: label.x - label.maxWidth / 2,
            width: label.maxWidth,
            alignItems: "center" as const,
          };
  return (
    <View style={[styles.label, { top: label.y }, position]}>
      <Text
        className={`text-[13px] ${label.isStrong ? "font-semibold text-foreground" : "text-muted"}`}
        style={{ maxWidth: label.maxWidth }}
        numberOfLines={1}
        maxFontSizeMultiplier={1.2}
      >
        {label.text}
      </Text>
    </View>
  );
}

/**
 * The chosen route as a line in the line's color, with the stop the line was opened from on it, an
 * arrowhead the way it's taken and a filled dot where it ends, and where the other routes go in
 * gray. Each dot heads towards its stop.
 */
export const LineDiagram = memo(function LineDiagram({
  line,
  routes,
  selected,
  reversed,
  fromStationId,
  stationsById,
  onSelectStop,
}: {
  line: Line;
  /** The line's routes the same way round, with only the stops the stations know, like the list. */
  routes: readonly (readonly string[])[];
  /** The chosen route. */
  selected: number;
  /** Whether it's taken from its last stop to its first. */
  reversed: boolean;
  fromStationId: string | null;
  stationsById: ReadonlyMap<string, Station>;
  onSelectStop: (stop: DiagramStop) => void;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const width = windowWidth - sheetPadding * 2;
  const [surfaceColor, branchColor] = useThemeColor(["surface", "surface-tertiary"]);
  const theme = useUniwind().theme === "light" ? "light" : "dark";
  const color = getLineColorOnSheet(getLineColor(line), theme);
  const chevronColor = getLineIconColor(color);

  const diagram = useMemo(() => {
    const name = (id: string) => {
      const station = stationsById.get(id);
      return station ? shortStationName(station.name) : "";
    };
    return layoutLineDiagram({
      routes: routes.map((stations) => ({ stations })),
      selected,
      reversed,
      focusId: fromStationId,
      width,
      nameOf: name,
      viaOf: (ids) => {
        const via = getViaStation(ids, stationsById);
        return via ? shortStationName(via.name) : null;
      },
    });
  }, [routes, selected, reversed, fromStationId, width, stationsById]);
  if (!diagram) return null;
  const { main } = diagram;

  return (
    <View className="mt-5" style={{ height: diagram.height }}>
      <Svg pointerEvents="none" accessible={false} width={diagram.width} height={diagram.height}>
        <G y={diagram.shift}>
          {diagram.branches.map((path) => (
            <Path
              key={path}
              d={path}
              stroke={branchColor}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          {main.type === "path" ? (
            <Path
              d={main.d}
              stroke={color}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : (
            <Ellipse
              cx={main.cx}
              cy={main.cy}
              rx={main.rx}
              ry={main.ry}
              stroke={color}
              strokeWidth={5}
              fill="none"
            />
          )}
        </G>
        {diagram.chevron && (
          <G x={diagram.chevron.x} y={diagram.chevron.y} rotation={diagram.chevron.angle}>
            <Circle r={9} fill={color} />
            <Path
              d="M-2 -4.5L2.5 0L-2 4.5"
              stroke={chevronColor}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </G>
        )}
        {diagram.stops.map(({ x, y, kind }, index) => {
          switch (kind) {
            case "focus":
              return (
                <G key={index}>
                  <Circle cx={x} cy={y} r={10} fill={surfaceColor} stroke={color} strokeWidth={4} />
                  <Circle cx={x} cy={y} r={3} fill={color} />
                </G>
              );
            case "destination":
              return (
                <Circle
                  key={index}
                  cx={x}
                  cy={y}
                  r={7.5}
                  fill={color}
                  stroke={color}
                  strokeWidth={3}
                />
              );
            case "terminus":
            case "branch":
              return (
                <Circle
                  key={index}
                  cx={x}
                  cy={y}
                  r={6}
                  fill={surfaceColor}
                  stroke={kind === "branch" ? branchColor : color}
                  strokeWidth={3}
                />
              );
            case "bypass":
            case "named":
              return (
                <Circle
                  key={index}
                  cx={x}
                  cy={y}
                  r={kind === "bypass" ? 5 : 3.5}
                  fill={surfaceColor}
                  stroke={kind === "bypass" ? branchColor : color}
                  strokeWidth={3}
                />
              );
            default:
              // The other stops on the chosen route are only there to tap.
              return null;
          }
        })}
      </Svg>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        {diagram.labels.map((label, index) => (
          <DiagramText key={index} label={label} width={diagram.width} />
        ))}
      </View>
      {diagram.stops.map((stop, index) => {
        // Divide dense dots at their midpoints so overlapping targets never pick the wrong stop.
        let left = Math.max(0, stop.x - 22);
        let right = Math.min(diagram.width, stop.x + 22);
        let top = Math.max(0, stop.y - 22);
        let bottom = Math.min(diagram.height, stop.y + 22);
        for (const other of diagram.stops) {
          if (other === stop) continue;
          if (Math.abs(other.y - stop.y) < 22) {
            if (other.x < stop.x) left = Math.max(left, (other.x + stop.x) / 2);
            if (other.x > stop.x) right = Math.min(right, (other.x + stop.x) / 2);
          }
          if (Math.abs(other.x - stop.x) < 22) {
            if (other.y < stop.y) top = Math.max(top, (other.y + stop.y) / 2);
            if (other.y > stop.y) bottom = Math.min(bottom, (other.y + stop.y) / 2);
          }
        }
        const station = stationsById.get(stop.stationId);
        return (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityLabel={`Show ${station ? shortStationName(station.name) : "stop"} in stop list`}
            onPress={() => onSelectStop(stop)}
            style={{ position: "absolute", left, top, width: right - left, height: bottom - top }}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  label: { position: "absolute", height: LABEL_HEIGHT, justifyContent: "center" },
});
