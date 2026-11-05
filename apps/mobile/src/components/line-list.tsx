import type { Station } from "@repo/data/types";
import { getStationLines } from "@repo/data/lines";
import { useThemeColor } from "heroui-native/hooks";
import { ListGroup } from "heroui-native/list-group";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import Route from "lucide-react-native/icons/route";
import { Fragment, memo, useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";

import { CountryFlag } from "@/components/country-flag";
import { LineBadge } from "@/components/line-badge";
import { HighlightedName, RowSeparator, SectionTitle } from "@/components/station-list";
import {
  getLineCountry,
  getLineOperatorName,
  getLineTermini,
  lineTypeLabels,
  type Line,
} from "@/lib/lines";

/** "Metro · ATM": tells apart lines with the same name, like each city's "Metro M1". */
export function getLineDescription(line: Line) {
  return [lineTypeLabels[line.type], getLineOperatorName(line)].filter(Boolean).join(" · ");
}

interface LineRowProps {
  line: Line;
  /** Below the name; the line's type and operator by default. */
  description?: string;
  suffix?: ReactNode;
  /** The search query, to show what it matched in the name. */
  highlight?: string;
  /** Off where the country is already known, like the lines of an open station. */
  showCountry?: boolean;
  onSelect: (line: Line) => void;
}

/** A line in a list, laid out like a station's row with the line's badge for its icon. */
export const LineRow = memo(function LineRow({
  line,
  description = getLineDescription(line),
  suffix,
  highlight,
  showCountry = true,
  onSelect,
}: LineRowProps) {
  return (
    <ListGroup.Item
      accessibilityRole="button"
      // A plain highlight, like the station rows.
      className="active:bg-surface-tertiary"
      onPress={() => onSelect(line)}
    >
      <ListGroup.ItemPrefix>
        <LineBadge line={line} size="icon" />
      </ListGroup.ItemPrefix>
      <ListGroup.ItemContent>
        <View className="flex-row items-center gap-2">
          <ListGroup.ItemTitle numberOfLines={1} className="shrink">
            <HighlightedName name={line.name} query={highlight} />
          </ListGroup.ItemTitle>
          {showCountry ? <CountryFlag country={getLineCountry(line)} /> : null}
        </View>
        {description ? (
          <ListGroup.ItemDescription numberOfLines={1}>{description}</ListGroup.ItemDescription>
        ) : null}
      </ListGroup.ItemContent>
      {suffix ? <ListGroup.ItemSuffix>{suffix}</ListGroup.ItemSuffix> : null}
    </ListGroup.Item>
  );
});

// A stop's sheet peeks down to this many of its lines; the busiest stops have eight.
const peekLineCount = 3;

/** The lines serving a station, each opening the line. Nothing for a station without lines. */
export const StationLines = memo(function StationLines({
  station,
  stationsById,
  onSelectLine,
  onPeekBottomChange,
}: {
  station: Station;
  /** Names where each line runs, once the stations have loaded. */
  stationsById: ReadonlyMap<string, Station> | null;
  onSelectLine: (line: Line) => void;
  /** Where the first few lines end, from the top of the section's parent. */
  onPeekBottomChange?: (bottom: number) => void;
}) {
  const mutedColor = useThemeColor("muted");
  const lines = getStationLines(station.id);
  const [layout, setLayout] = useState<{ top: number; listTop: number; listHeight: number }>({
    top: 0,
    listTop: 0,
    listHeight: 0,
  });

  useEffect(() => {
    if (!onPeekBottomChange || !layout.listHeight || lines.length === 0) return;
    // The rows are all as tall, a name over where the line runs.
    const shown = Math.min(lines.length, peekLineCount) / lines.length;
    onPeekBottomChange(layout.top + layout.listTop + layout.listHeight * shown);
  }, [onPeekBottomChange, layout, lines.length]);

  if (lines.length === 0) return null;

  return (
    <View
      className="mt-5"
      onLayout={(event) => {
        const { y } = event.nativeEvent.layout;
        setLayout((current) => (current.top === y ? current : { ...current, top: y }));
      }}
    >
      <SectionTitle icon={<Route size={14} color={mutedColor} />}>
        {lines.length === 1 ? "Line" : `${lines.length} lines`}
      </SectionTitle>
      <ListGroup
        variant="secondary"
        className="overflow-hidden"
        onLayout={(event) => {
          const { y, height } = event.nativeEvent.layout;
          setLayout((current) =>
            current.listTop === y && current.listHeight === height
              ? current
              : { ...current, listTop: y, listHeight: height },
          );
        }}
      >
        {lines.map((line, index) => (
          <Fragment key={line.id}>
            {index > 0 ? <RowSeparator /> : null}
            <LineRow
              line={line}
              description={
                (stationsById && getLineTermini(line, stationsById)) || getLineDescription(line)
              }
              suffix={<ChevronRight size={16} color={mutedColor} />}
              // The station's header already shows its country.
              showCountry={false}
              onSelect={onSelectLine}
            />
          </Fragment>
        ))}
      </ListGroup>
    </View>
  );
});
