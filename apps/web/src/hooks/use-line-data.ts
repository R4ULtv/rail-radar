import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { getLineStationIds } from "@repo/data/lines";

import { APIError, apiFetcher, buildApiUrl, endpoints } from "@/lib/api";
import type { LineData, LinesGeoJsonResponse } from "@/lib/api";

type Pending = { resolve: (data: LineData) => void; reject: (error: unknown) => void };

let batch: Map<string, Pending[]> | null = null;

/** Lines asked for in the same tick share one request; each is then cached on its own. */
function fetchLine(id: string): Promise<LineData> {
  if (!batch) {
    const pending = new Map<string, Pending[]>();
    batch = pending;
    setTimeout(() => {
      batch = null;
      void fetchBatch(pending);
    });
  }
  const pending = batch;
  return new Promise((resolve, reject) => {
    const waiting = pending.get(id);
    if (waiting) waiting.push({ resolve, reject });
    else pending.set(id, [{ resolve, reject }]);
  });
}

async function fetchBatch(pending: Map<string, Pending[]>) {
  // Sorted, so every client asking for the same lines shares one cached URL.
  const ids = [...pending.keys()].sort();
  try {
    const response = await apiFetcher<LinesGeoJsonResponse>(buildApiUrl(endpoints.lines(ids)));
    const features = new Map(response.features.map((feature) => [feature.id, feature]));
    for (const [id, waiting] of pending) {
      const feature = features.get(id);
      const data: LineData | Error = feature
        ? {
            id,
            geometry: feature.geometry,
            stops: Object.fromEntries(
              getLineStationIds(feature.properties).flatMap((stationId) => {
                const stop = response.stops[stationId];
                return stop ? [[stationId, stop]] : [];
              }),
            ),
          }
        : new Error(`Line ${id} is missing from the response`);
      for (const { resolve, reject } of waiting) {
        if (data instanceof Error) reject(data);
        else resolve(data);
      }
    }
  } catch (error) {
    // The API rejects a whole request over one ID it doesn't know, as when the web app is
    // deployed with a line the API doesn't have yet. Asked for one by one, only that line fails.
    if (error instanceof APIError && error.status === 400 && pending.size > 1) {
      for (const entry of pending) void fetchBatch(new Map([entry]));
      return;
    }
    for (const waiting of pending.values()) for (const { reject } of waiting) reject(error);
  }
}

function combine(results: UseQueryResult<LineData>[]) {
  return {
    data: results.map((result) => result.data),
    isPending: results.map((result) => result.isPending),
    isError: results.map((result) => result.isError),
  };
}

/**
 * Hook for the track and stops of lines, in the order of `lineIds`
 * Line data only changes on deploy, so each line is fetched once per session; stepping
 * between stations of lines already loaded costs no request
 *
 * @param lineIds - Line IDs from the bundled catalog
 * @returns Per line, its data once loaded and whether it is pending or failed
 */
export function useLineData(lineIds: readonly string[]) {
  return useQueries({
    queries: lineIds.map((id) => ({
      queryKey: ["line", id],
      queryFn: () => fetchLine(id),
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnWindowFocus: false,
    })),
    combine,
  });
}
