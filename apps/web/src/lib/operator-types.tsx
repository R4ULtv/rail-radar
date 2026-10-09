import type { OperatorType } from "@repo/data/operators";
import { cn } from "@repo/ui/lib/utils";
import {
  FREIGHT_ICON_SVG,
  LIGHT_ICON_SVG,
  METRO_ICON_SVG,
  RAIL_ICON_SVG,
  svgDataUri,
} from "@/lib/station-marker-icons";

/** Display order for operator modes; a mode no operator uses is never shown. */
export const OPERATOR_TYPES = [
  "passenger",
  "cargo",
  "light-rail",
  "metro",
] as const satisfies readonly OperatorType[];

export function isOperatorType(value: unknown): value is OperatorType {
  return OPERATOR_TYPES.includes(value as OperatorType);
}

export const operatorTypeLabels: Record<OperatorType, string> = {
  passenger: "Passenger",
  cargo: "Freight",
  metro: "Metro",
  "light-rail": "Light rail",
};

/** Fill colors of the markers in station-marker-icons.ts, for tinting around them. */
export const operatorTypeColors: Record<OperatorType, string> = {
  passenger: "#4b61d1",
  cargo: "#d97706",
  metro: "#f22a18",
  "light-rail": "#14b8a6",
};

const operatorTypeMarkers: Record<OperatorType, string> = {
  passenger: svgDataUri(RAIL_ICON_SVG),
  cargo: svgDataUri(FREIGHT_ICON_SVG),
  metro: svgDataUri(METRO_ICON_SVG),
  "light-rail": svgDataUri(LIGHT_ICON_SVG),
};

/** The same marker the map draws for the mode's stations. */
export function OperatorTypeMarker({
  type,
  className,
}: {
  type: OperatorType;
  className?: string;
}) {
  return (
    <img
      src={operatorTypeMarkers[type]}
      alt=""
      width={20}
      height={20}
      draggable={false}
      className={cn("size-5 shrink-0 select-none", className)}
    />
  );
}

/** Orders an operator's modes consistently, whatever order operators.json lists them in. */
export function sortOperatorTypes(types: readonly OperatorType[]): OperatorType[] {
  return OPERATOR_TYPES.filter((type) => types.includes(type));
}

/** "Rail Operator" when it runs mainline trains, otherwise the urban modes it runs, for titles. */
export function operatorRole(types: readonly OperatorType[]): string {
  if (types.includes("passenger")) return "Rail Operator";
  const modes = sortOperatorTypes(types).map((type) =>
    type === "light-rail" ? "Light Rail" : operatorTypeLabels[type],
  );
  return `${modes.join(" & ") || "Rail"} Operator`;
}
