import type { Station } from "@repo/data/types";
import { useThemeColor } from "heroui-native/hooks";
import { memo, useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Ellipse, Line as SvgLine, Path } from "react-native-svg";

import { LABEL_HEIGHT, layoutLineDiagram, type DiagramLabel } from "@/lib/line-diagram";
import { getLineColor, getViaStation, shortStationName, type Line } from "@/lib/lines";

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
        className={`text-xs ${label.isStrong ? "font-semibold text-foreground" : "text-muted"}`}
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
 * The chosen route as a line in the line's color, with the stop the line was opened from on it,
 * and where the other routes go in gray. A picture of what the routes card lists, so it's hidden
 * from screen readers.
 */
export const LineDiagram = memo(function LineDiagram({
  line,
  branch,
  fromStationId,
  stationsById,
}: {
  line: Line;
  branch: number;
  fromStationId: string | null;
  stationsById: ReadonlyMap<string, Station>;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const width = windowWidth - sheetPadding * 2;
  const [surfaceColor, branchColor] = useThemeColor(["surface", "surface-tertiary"]);
  const color = getLineColor(line);

  const diagram = useMemo(() => {
    const name = (id: string) => {
      const station = stationsById.get(id);
      return station ? shortStationName(station.name) : "";
    };
    return layoutLineDiagram({
      // Only the stops the stations know, like the list.
      routes: line.routes.map((route) => ({
        stations: route.stations.filter((id) => stationsById.has(id)),
      })),
      selected: branch,
      focusId: fromStationId,
      width,
      nameOf: name,
      viaOf: (ids) => {
        const via = getViaStation(ids, stationsById);
        return via ? shortStationName(via.name) : null;
      },
    });
  }, [line, branch, fromStationId, width, stationsById]);
  if (!diagram) return null;
  const { main } = diagram;

  return (
    <View
      className="mt-5"
      style={{ height: diagram.height }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={diagram.width} height={diagram.height}>
        {diagram.branches.map((path) => (
          <Path
            key={path}
            d={path}
            stroke={branchColor}
            strokeWidth={4}
            strokeLinejoin="round"
            fill="none"
          />
        ))}
        {main.type === "line" ? (
          <SvgLine
            x1={main.from[0]}
            y1={main.from[1]}
            x2={main.to[0]}
            y2={main.to[1]}
            stroke={color}
            strokeWidth={6}
          />
        ) : (
          <Ellipse
            cx={main.cx}
            cy={main.cy}
            rx={main.rx}
            ry={main.ry}
            stroke={color}
            strokeWidth={6}
            fill="none"
          />
        )}
        {diagram.stops.map(({ x, y, kind }, index) => {
          switch (kind) {
            case "stop":
              return <Circle key={index} cx={x} cy={y} r={1.5} fill={surfaceColor} />;
            case "named":
            case "branch":
              return (
                <Circle
                  key={index}
                  cx={x}
                  cy={y}
                  r={3.5}
                  fill={surfaceColor}
                  stroke={kind === "named" ? color : branchColor}
                  strokeWidth={3}
                />
              );
            default:
              // Like the big dots on the stops' strip.
              return (
                <Circle
                  key={index}
                  cx={x}
                  cy={y}
                  r={6}
                  fill={surfaceColor}
                  stroke={color}
                  strokeWidth={4}
                />
              );
          }
        })}
        {diagram.stops
          .filter(({ kind }) => kind === "focus")
          .map(({ x, y }) => (
            <Circle key={`${x}-${y}`} cx={x} cy={y} r={2.5} fill={color} />
          ))}
      </Svg>
      {diagram.labels.map((label, index) => (
        <DiagramText key={index} label={label} width={diagram.width} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  label: { position: "absolute", height: LABEL_HEIGHT, justifyContent: "center" },
});
