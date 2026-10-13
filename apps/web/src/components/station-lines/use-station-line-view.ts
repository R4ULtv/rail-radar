"use client";

import type { Line, Station } from "@repo/data";
import { getStationLines } from "@repo/data/lines";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useLineData } from "@/hooks/use-line-data";
import { useSelectedStation } from "@/hooks/use-selected-station";
import type { LineData, LineStop } from "@/lib/api";
import { getLineColor } from "@/lib/line-colors";
import { shortStationName } from "@/lib/station-name";

const NO_LINES: readonly Line[] = [];

/**
 * The lines serving a metro or light rail station, and which line and branch the
 * panel shows. The lines come from the bundled catalog, so the panel knows them at
 * once; only their track and stop names are fetched, once per line. The choice
 * survives stepping along the line to another of its stops.
 */
export function useStationLineView(station: Station | null) {
  const stationId = station && station.type !== "rail" ? station.id : null;
  const lines = stationId ? getStationLines(stationId) : NO_LINES;
  const ids = useMemo(() => lines.map((line) => line.id), [lines]);
  const query = useLineData(ids);
  const queryClient = useQueryClient();
  const { selectStation } = useSelectedStation();
  const [preferred, setPreferred] = useState<{ lineId: string | null; route: number | null }>({
    lineId: null,
    route: null,
  });

  const loaded = useMemo(
    () =>
      new Map(query.data.flatMap((data): [string, LineData][] => (data ? [[data.id, data]] : []))),
    [query.data],
  );
  const stops = useMemo(() => {
    const merged: Record<string, LineStop> = {};
    for (const data of loaded.values()) Object.assign(merged, data.stops);
    return merged;
  }, [loaded]);

  const index = Math.max(
    ids.findIndex((id) => id === preferred.lineId),
    0,
  );
  const line = lines[index] ?? null;
  const routes = line
    ? line.routes.flatMap((route, i) =>
        stationId && route.stations.includes(stationId) ? [i] : [],
      )
    : [];
  const route =
    line?.id === preferred.lineId && preferred.route !== null && routes.includes(preferred.route)
      ? preferred.route
      : (routes[0] ?? 0);

  const selectStop = (id: string) => {
    const stop = stops[id];
    if (!stop) return;
    if (line) setPreferred({ lineId: line.id, route });
    selectStation({
      id,
      name: stop.name,
      type: stop.type,
      importance: stop.importance,
      geo: stop.geo,
    });
  };

  return {
    stationId,
    lines,
    line,
    routes,
    route,
    /** Track and stops of the lines loaded so far. */
    loaded,
    /** Every loaded stop, by station ID. */
    stops,
    isLoading: line !== null && (query.isPending[index] ?? false),
    isError: line !== null && (query.isError[index] ?? false),
    retry: () =>
      void queryClient.refetchQueries({
        queryKey: ["line"],
        predicate: (cached) => cached.state.status === "error",
      }),
    selectLine: (lineId: string) => setPreferred({ lineId, route: null }),
    selectRoute: (i: number) => setPreferred({ lineId: line?.id ?? null, route: i }),
    selectStop,
  };
}

export type StationLineView = ReturnType<typeof useStationLineView>;

export function stopName(view: StationLineView, id: string | undefined): string {
  const name = id ? view.stops[id]?.name : undefined;
  return name ? shortStationName(name) : "";
}

export function badgeLine(line: Line) {
  return { code: line.code, name: line.name, type: line.type, color: getLineColor(line) };
}
