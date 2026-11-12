/** Latency percentiles in legend order. Shared by the panel key and the lazy-loaded chart. */
export const LATENCY_SERIES = [
  { key: "p50", label: "p50" },
  { key: "p90", label: "p90" },
  { key: "p99", label: "p99" },
] as const;

export type LatencyKey = (typeof LATENCY_SERIES)[number]["key"];
