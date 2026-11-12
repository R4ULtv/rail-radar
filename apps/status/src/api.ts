import type { StatusLatency, StatusSummary } from "@repo/data/status";

export const API_URL = (
  import.meta.env.PUBLIC_API_URL?.trim() || "https://api.railradar24.com"
).replace(/\/+$/, "");
export const API_HOST = new URL(API_URL).host;

export interface ApiObservation {
  observedAt: string;
  responseMs: number;
}

async function read<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}/status/${path}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  });
  if (!response.ok) throw new Error(`Status API returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export const summaryQuery = {
  queryKey: ["status", "summary"],
  queryFn: ({ signal }: { signal: AbortSignal }) => read<StatusSummary>("summary", signal),
  staleTime: 60_000,
  refetchInterval: 60_000,
};

export const latencyQuery = {
  queryKey: ["status", "latency"],
  queryFn: ({ signal }: { signal: AbortSignal }) => read<StatusLatency>("latency", signal),
  // History is daily buckets and the API caches it for 15 minutes.
  staleTime: 900_000,
  refetchInterval: 900_000,
};

/** A visitor's current request, independent of the Analytics Engine read endpoints. */
export const reachabilityQuery = {
  queryKey: ["status", "reachability"],
  queryFn: async ({ signal }: { signal: AbortSignal }): Promise<ApiObservation> => {
    const started = performance.now();
    const response = await fetch(`${API_URL}/`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      cache: "no-store",
    });
    if (!response.ok || !(await response.text()).startsWith("Rail Radar API")) {
      throw new Error("Unable to verify the Rail Radar API response");
    }
    return { observedAt: new Date().toISOString(), responseMs: performance.now() - started };
  },
  staleTime: 60_000,
  refetchInterval: 60_000,
};
