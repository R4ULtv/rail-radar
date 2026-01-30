"use client";

import { TrendingUpIcon, BarChart3Icon } from "lucide-react";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useStationStats } from "@/hooks/use-station-stats";

interface StationStatsProps {
  stationId: number;
}

export function StationStats({ stationId }: StationStatsProps) {
  const { data, isLoading } = useStationStats(stationId, "week");

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

  const { station, topStation, comparison } = data ?? {};

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Station Statistics
      </h2>

      {station ? (
        <div className="space-y-2">
          {comparison?.isTopStation && (
            <div className="flex items-center gap-2">
              <TrendingUpIcon className="size-4 text-emerald-500" />
              <span className="text-sm font-medium">#1 Trending Station</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3Icon className="size-4" />
            <span>
              {station.visits.toLocaleString()} visits (
              {station.uniqueVisitors.toLocaleString()} unique) in the last 7
              days
            </span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No visit data available</p>
      )}

      {station &&
        topStation &&
        comparison &&
        comparison.percentage !== null && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              {comparison.isTopStation ? (
                <>
                  This is the{" "}
                  <span className="font-medium text-foreground">
                    most visited station
                  </span>{" "}
                  this week.
                </>
              ) : (
                <>
                  This station has{" "}
                  <span className="font-medium text-foreground">
                    {comparison.percentage.toFixed(1)}%
                  </span>{" "}
                  of the traffic of the{" "}
                  <span className="font-medium text-foreground">
                    #1 {topStation.stationName}
                  </span>{" "}
                  station this week.
                </>
              )}
            </p>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.min(comparison.percentage, 100)}%` }}
              />
            </div>
          </div>
        )}
    </section>
  );
}
