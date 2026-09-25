import Mapbox, { type LineLayerStyle, type SymbolLayerStyle } from "@rnmapbox/maps";
import type { ComponentProps } from "react";

import { stationIcons } from "@/lib/station-icons";

// Mirrors apps/web/src/components/station-markers.tsx. Keep the icons, zoom
// levels and sizes in sync with the web map.

const RAIL_ICON_ID = "rail-icon";
const METRO_ICON_ID = "metro-icon";
const LIGHT_ICON_ID = "light-icon";

type LayerFilter = NonNullable<ComponentProps<typeof Mapbox.SymbolLayer>["filter"]>;
type ShapeSourcePressEvent = Parameters<
  NonNullable<ComponentProps<typeof Mapbox.ShapeSource>["onPress"]>
>[0];

// Like the web, the icons are 64pt images scaled down by `iconSize`.
const mapIcons = {
  [RAIL_ICON_ID]: stationIcons.rail,
  [METRO_ICON_ID]: stationIcons.metro,
  [LIGHT_ICON_ID]: stationIcons.light,
};

export function StationImages() {
  return <Mapbox.Images images={mapIcons} />;
}

/** Minimum zoom derived from importance + type. */
const MINZOOM_EXPR = [
  "match",
  ["get", "type"],
  "metro",
  13,
  "light",
  ["match", ["get", "importance"], 3, 11, 13],
  /* rail */ ["match", ["get", "importance"], 1, 3, 2, 7, 3, 9, 11],
];
const MINZOOM_FILTER = ["<=", MINZOOM_EXPR, ["zoom"]];
const LABEL_MINZOOM_FILTER = ["<=", ["+", MINZOOM_EXPR, 2], ["zoom"]];

function typeFilter(type: string, minZoomFilter: unknown[]) {
  return ["all", ["==", ["get", "type"], type], minZoomFilter] as LayerFilter;
}

export type LabelColors = { labelColor: string; labelHaloColor: string };

function labelStyle(textSize: number, colors: LabelColors): SymbolLayerStyle {
  return {
    textField: ["get", "name"],
    textSize,
    textOffset: [0, 1.3],
    textAnchor: "top",
    textOptional: true,
    textColor: colors.labelColor,
    textHaloColor: colors.labelHaloColor,
    textHaloWidth: 1.5,
    textHaloBlur: 1,
  };
}

const railwayLineWidth: LineLayerStyle["lineWidth"] = [
  "interpolate",
  ["linear"],
  ["zoom"],
  6,
  0.5,
  10,
  1,
  14,
  2,
];

export function RailwayLines() {
  return (
    <>
      <Mapbox.LineLayer
        id="railway-lines-tunnel"
        sourceID="composite"
        sourceLayerID="road"
        filter={[
          "all",
          ["==", ["get", "structure"], "tunnel"],
          ["==", ["get", "class"], "major_rail"],
        ]}
        style={{
          lineColor: "#4B61D1",
          lineWidth: railwayLineWidth,
          lineOpacity: 0.4,
          lineDasharray: [2, 2],
        }}
      />
      <Mapbox.LineLayer
        id="railway-lines"
        sourceID="composite"
        sourceLayerID="road"
        filter={[
          "all",
          ["==", ["get", "class"], "major_rail"],
          ["match", ["get", "structure"], ["none", "ford"], true, false],
        ]}
        style={{ lineColor: "#4B61D1", lineWidth: railwayLineWidth, lineOpacity: 0.6 }}
      />
      <Mapbox.LineLayer
        id="railway-lines-bridge"
        sourceID="composite"
        sourceLayerID="road"
        filter={[
          "all",
          ["==", ["get", "structure"], "bridge"],
          ["==", ["get", "class"], "major_rail"],
        ]}
        style={{ lineColor: "#4B61D1", lineWidth: railwayLineWidth, lineOpacity: 0.6 }}
      />
    </>
  );
}

export function StationLayers({
  url,
  labelColors,
  onPress,
}: {
  url: string;
  labelColors: LabelColors;
  onPress: (event: ShapeSourcePressEvent) => void;
}) {
  return (
    <Mapbox.ShapeSource id="stations-source" url={url} onPress={onPress}>
      <Mapbox.SymbolLayer
        id="metro-stations"
        filter={typeFilter("metro", MINZOOM_FILTER)}
        style={{
          iconImage: METRO_ICON_ID,
          iconSize: ["interpolate", ["linear"], ["zoom"], 14, 0.25, 16, 0.35],
          iconAllowOverlap: false,
          iconAnchor: "center",
        }}
      />
      <Mapbox.SymbolLayer
        id="metro-labels"
        filter={typeFilter("metro", LABEL_MINZOOM_FILTER)}
        style={labelStyle(12, labelColors)}
      />
      <Mapbox.SymbolLayer
        id="light-stations"
        filter={typeFilter("light", MINZOOM_FILTER)}
        style={{
          iconImage: LIGHT_ICON_ID,
          iconSize: [
            "interpolate",
            ["linear"],
            ["zoom"],
            11,
            ["match", ["get", "importance"], 3, 0.25, 0.2],
            14,
            ["match", ["get", "importance"], 3, 0.3, 0.25],
            16,
            ["match", ["get", "importance"], 3, 0.35, 0.3],
          ],
          iconAllowOverlap: false,
          iconAnchor: "center",
          symbolSortKey: ["get", "importance"],
        }}
      />
      <Mapbox.SymbolLayer
        id="light-labels"
        filter={typeFilter("light", LABEL_MINZOOM_FILTER)}
        style={labelStyle(12, labelColors)}
      />
      <Mapbox.SymbolLayer
        id="rail-stations"
        filter={typeFilter("rail", MINZOOM_FILTER)}
        style={{
          iconImage: RAIL_ICON_ID,
          iconSize: [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            ["match", ["get", "importance"], 1, 0.3, 2, 0.25, 0.2],
            10,
            ["match", ["get", "importance"], 1, 0.35, 2, 0.32, 0.3],
            13,
            ["match", ["get", "importance"], 1, 0.4, 2, 0.37, 0.35],
          ],
          iconAllowOverlap: false,
          iconAnchor: "center",
          symbolSortKey: ["get", "importance"],
        }}
      />
      <Mapbox.SymbolLayer
        id="rail-labels"
        filter={typeFilter("rail", LABEL_MINZOOM_FILTER)}
        style={labelStyle(13, labelColors)}
      />
    </Mapbox.ShapeSource>
  );
}
