import { lazy, Suspense } from "react";
import type { LatencyDay } from "@repo/data/status";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@repo/ui/components/empty";
import { Skeleton } from "@repo/ui/components/skeleton";
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
  return (
    <section className="latency-panel" aria-label={`${name} response time`}>
      <div className="chart-heading">
        <div>
          <h4>{title}</h4>
          <p>Daily percentiles in milliseconds, log scale</p>
        </div>
        <div className="chart-key">
          <span data-series="p50">p50</span>
          <span data-series="p99">p99</span>
          <span data-series="p999">p99.9</span>
        </div>
      </div>
      {latest && days ? (
        <Suspense fallback={<Skeleton className="chart-skeleton" />}>
          <LatencyChart days={days} name={name} />
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
