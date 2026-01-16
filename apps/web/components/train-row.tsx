import type { Train } from "@repo/data";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandLogo } from "@/components/brands";
import { ArrowRightIcon, ArrowDownIcon, BanIcon } from "lucide-react";

interface TrainRowProps {
  train: Train;
  type: "arrivals" | "departures";
}

export function TrainRow({ train, type }: TrainRowProps) {
  const route = type === "arrivals" ? train.origin : train.destination;
  const hasDelay = train.delay !== null && train.delay > 0;

  return (
    <div
      className={cn(
        "flex gap-3 py-3 px-4 border-b border-border last:border-b-0",
        train.status === "departing" &&
          "border-l-3 md:border-l-2 border-l-blue-500",
        train.status === "incoming" &&
          "border-l-3 md:border-l-2 border-l-green-500",
        train.status === "cancelled" &&
          "border-l-3 md:border-l-2 border-l-red-500",
      )}
    >
      {/* Platform badge */}
      <div className="shrink-0 min-w-12 h-12 px-2 bg-muted rounded-md flex items-center justify-center">
        <span
          className={cn(
            "font-bold text-center",
            (train.platform?.length ?? 0) > 2 ? "text-sm" : "text-xl",
          )}
        >
          {train.platform ?? "–"}
        </span>
      </div>

      {/* Train details */}
      <div className="flex-1 min-w-0">
        {/* Line 1: Train info + Time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <BrandLogo brand={train.brand} className="size-4 rounded" />
            {train.category && (
              <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {train.category}
              </span>
            )}
            <span className="font-medium">{train.trainNumber}</span>
          </div>
          <div className="flex items-center gap-2 tabular-nums">
            <span className="font-medium">{train.scheduledTime}</span>
            {hasDelay && (
              <span className="text-xs font-medium text-red-600 dark:text-red-400">
                +{train.delay} min
              </span>
            )}
          </div>
        </div>

        {/* Line 2: Route + Status */}
        <div className="mt-1 flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground truncate">
            {route
              ? type === "arrivals"
                ? `From ${route}`
                : `To ${route}`
              : "–"}
          </span>
          {train.status && (
            <span
              className={cn(
                "text-xs font-medium capitalize shrink-0 inline-flex items-center gap-1",
                train.status === "incoming" &&
                  "text-green-600 dark:text-green-400",
                train.status === "departing" &&
                  "text-blue-600 dark:text-blue-400",
                train.status === "cancelled" &&
                  "text-red-600 dark:text-red-400",
              )}
            >
              {train.status === "departing" && (
                <ArrowRightIcon className="size-3" />
              )}
              {train.status === "incoming" && (
                <ArrowDownIcon className="size-3" />
              )}
              {train.status === "cancelled" && <BanIcon className="size-3" />}
              {train.status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function TrainRowSkeleton() {
  return (
    <div className="flex gap-3 py-3 px-4 border-b border-border last:border-b-0">
      {/* Platform badge skeleton */}
      <Skeleton className="shrink-0 w-12 h-12 rounded-md" />

      {/* Train details skeleton */}
      <div className="flex-1 min-w-0">
        {/* Line 1: Train info + Time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-5 w-10" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-5 w-12" />
        </div>

        {/* Line 2: Route + Status */}
        <div className="mt-1 flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}
