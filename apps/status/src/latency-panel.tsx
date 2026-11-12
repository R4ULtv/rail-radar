import { lazy, Suspense, useState } from "react";
import type { LatencyDay } from "@repo/data/status";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@repo/ui/components/empty";
import { Skeleton } from "@repo/ui/components/skeleton";
import { LATENCY_SERIES, type LatencyKey } from "./latency-series";
import { latestTimedDay } from "./presentation";

const LatencyChart = lazy(() => import("./latency-chart"));

export function LatencyPanel({
  days,
  name,
  loading,
  error,
  title = "Response time",
  emptyDescription = "Response times appear when visitors request this provider’s station boards.",
}: {
  days?: LatencyDay[];
  name: string;
  loading: boolean;
  error: boolean;
  title?: string;
  emptyDescription?: string;
}) {
  const latest = latestTimedDay(days);
  // Hover previews a series; a click pins it so touch screens can isolate one too.
  const [hovered, setHovered] = useState<LatencyKey | null>(null);
  const [pinned, setPinned] = useState<LatencyKey | null>(null);
  const focused = hovered ?? pinned;
  return (
    <section className="latency-panel" aria-label={`${name} response time`}>
      <div className="chart-heading">
        <div>
          <h4>{title}</h4>
          <p>Daily percentiles in milliseconds, log scale</p>
        </div>
        {latest && days ? (
          <div
            className="chart-key"
            role="group"
            aria-label="Highlight a percentile"
            data-focused={focused ?? undefined}
            onPointerLeave={() => setHovered(null)}
          >
            {LATENCY_SERIES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                data-series={key}
                aria-pressed={pinned === key}
                onPointerEnter={() => setHovered(key)}
                onFocus={() => setHovered(key)}
                onBlur={() => setHovered(null)}
                onClick={() => setPinned((current) => (current === key ? null : key))}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {latest && days ? (
        <Suspense fallback={<Skeleton className="chart-skeleton" />}>
          <LatencyChart days={days} name={name} focused={focused} />
        </Suspense>
      ) : loading ? (
        <Skeleton className="chart-skeleton" />
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{error ? "History unavailable" : "No latency data yet"}</EmptyTitle>
            <EmptyDescription>
              {error
                ? "Use Refresh to try again. Current health is shown separately."
                : emptyDescription}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}
