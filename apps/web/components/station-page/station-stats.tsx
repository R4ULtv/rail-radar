"use client";

import useSWR from "swr";
import { TrendingUpIcon, BarChart3Icon } from "lucide-react";
import { Skeleton } from "@repo/ui/components/skeleton";

interface TrendingStation {
  stationId: number;
  stationName: string;
  visits: number;
  uniqueVisitors: number;
}

interface TrendingResponse {
  stations: TrendingStation[];
  period: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface StationStatsProps {
  stationId: number;
}

export function StationStats({ stationId }: StationStatsProps) {
  const { data, isLoading } = useSWR<TrendingResponse>(
    `${process.env.NEXT_PUBLIC_API_URL}/stations/trending?period=week`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const trendingStation = data?.stations.find((s) => s.stationId === stationId);
  const rank = data?.stations.findIndex((s) => s.stationId === stationId);
  const isRanked = rank !== undefined && rank !== -1;
  const topStation = data?.stations[0];
  const relativeTraffic =
    isRanked && trendingStation && topStation
      ? (trendingStation.visits / topStation.visits) * 100
      : null;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Station Statistics
        </h2>
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Station Statistics
      </h2>

      {isRanked && trendingStation ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUpIcon className="size-4 text-green-500" />
            <span className="text-sm font-medium">
              #{rank + 1} Trending Station
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3Icon className="size-4" />
            <span>
              {trendingStation.visits.toLocaleString()} visits (
              {trendingStation.uniqueVisitors.toLocaleString()} unique) in the
              last 7 days
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No trending data available
        </p>
      )}

      {relativeTraffic !== null && topStation && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            This station has{" "}
            <span className="font-medium text-foreground">
              {relativeTraffic.toFixed(1)}%
            </span>{" "}
            of the traffic of the{" "}
            <span className="font-medium text-foreground">
              #{1} {topStation.stationName}
            </span>{" "}
            station this week.
          </p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${Math.min(relativeTraffic, 100)}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
