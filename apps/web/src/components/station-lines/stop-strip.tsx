"use client";

import { getStationLines } from "@repo/data/lines";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useEffect, useRef } from "react";

import { LineBadge } from "@/components/line-badge";
import { getLineColor } from "@/lib/line-colors";
import { OperatorTypeMarker } from "@/lib/operator-types";
import { shortStationName } from "@/lib/station-name";
import { badgeLine, type StationLineView } from "./use-station-line-view";

/**
 * The shown branch as a vertical strip map in the line's color, scrolled to the
 * station. `align="start"` puts it near the top for the drawer's short snap points,
 * where `padEnd` leaves room to do that for stops near the end of the branch and
 * `peek` is how much of the drawer the snap point shows.
 */
export function StopStrip({
  view,
  align = "center",
  padEnd = false,
  peek,
  className,
}: {
  view: StationLineView;
  align?: "center" | "start";
  padEnd?: boolean;
  peek?: number;
  className?: string;
}) {
  const currentRef = useRef<HTMLLIElement>(null);
  const { stops, lines, line, route, stationId, isLoading, isError } = view;
  // Stops the API doesn't know (it deploys apart from the bundled catalog) are left out
  // rather than waited for.
  const stations = (line?.routes[route]?.stations ?? []).filter((id) => stops[id] !== undefined);
  const ready = line !== null && !isLoading;
  const shownRef = useRef<string | null>(null);

  useEffect(() => {
    const row = currentRef.current;
    const scroller = row?.closest<HTMLElement>("[data-slot=scroll-area-viewport], [data-scroll]");
    if (!row || !scroller) return;
    const box = scroller.getBoundingClientRect();
    const offset = row.getBoundingClientRect().top - box.top + scroller.scrollTop;
    // The drawer's lower snap points leave part of the strip below the screen. Measured
    // against the drawer rather than the screen, since it may still be sliding into place.
    const drawer = scroller.closest("[data-slot=drawer-popup]")?.getBoundingClientRect();
    const below = peek !== undefined && drawer ? peek - (box.top - drawer.top) : Infinity;
    const visible = Math.max(Math.min(scroller.clientHeight, below), 0);
    const room = Math.max(visible - row.offsetHeight, 0);
    // A third of the way down in the drawer, so the stop clears the top fade and the
    // ones before it still show.
    const top = offset - room * (align === "center" ? 0.5 : 0.3);
    // Glide when stepping along the branch already shown; jump to a new line or branch.
    const shown = `${line?.id}/${route}`;
    const step = shownRef.current === shown;
    shownRef.current = shown;
    scroller.scrollTo({ top, behavior: step ? "smooth" : "instant" });
  }, [stationId, line?.id, route, align, padEnd, peek, ready]);

  if (!stationId) return null;

  if (lines.length === 0) {
    return (
      <p className={cn("px-4 py-8 text-center text-sm text-muted-foreground", className)}>
        The lines of this station aren't mapped yet.
      </p>
    );
  }

  if (isError) {
    return (
      <div className={cn("flex flex-col items-center gap-3 px-4 py-8 text-center", className)}>
        <p className="text-sm text-muted-foreground">Couldn't load this line.</p>
        <Button variant="outline" size="sm" onClick={view.retry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!line || !ready) return <StopStripSkeleton className={className} />;

  if (stations.length === 0) {
    return (
      <p className={cn("px-4 py-8 text-center text-sm text-muted-foreground", className)}>
        The stops of this line aren't available right now.
      </p>
    );
  }

  const color = getLineColor(line);
  const served = new Set(lines.map((other) => other.id));

  return (
    <ol className={cn("px-3 pb-3", padEnd && "pb-[60vh]", className)}>
      {stations.map((id, index) => {
        const stop = stops[id]!;
        const first = index === 0;
        const last = index === stations.length - 1;
        const current = id === stationId;
        const others = getStationLines(id).filter((other) => other.id !== line.id);
        return (
          <li
            key={`${id}-${index}`}
            ref={current ? currentRef : undefined}
            aria-current={current ? "location" : undefined}
            className="relative flex"
          >
            <div className="relative flex w-5 shrink-0 justify-center" aria-hidden>
              <span
                className={cn(
                  "absolute w-1",
                  first ? "top-1/2" : "top-0",
                  last ? "bottom-1/2" : "bottom-0",
                )}
                style={{ backgroundColor: color }}
              />
              <span
                className={cn(
                  "relative self-center rounded-full",
                  current
                    ? "size-4"
                    : first || last
                      ? "size-3.5 border-[3px] bg-card"
                      : "size-2.5 border-2 bg-card",
                )}
                style={
                  current
                    ? {
                        backgroundColor: color,
                        boxShadow: `0 0 0 3px var(--color-card), 0 0 0 5px color-mix(in oklab, ${color} 45%, transparent)`,
                      }
                    : { borderColor: color }
                }
              />
            </div>
            <div
              className={cn(
                "relative ml-1 flex min-h-9 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2.5 py-1 transition-colors duration-150",
                !current && "lg:has-[>[data-stop]:hover]:bg-muted/60",
              )}
              style={
                current
                  ? { backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)` }
                  : undefined
              }
            >
              {current ? (
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {shortStationName(stop.name)}
                </span>
              ) : (
                <button
                  type="button"
                  data-stop
                  onClick={() => view.selectStop(id)}
                  className={cn(
                    "min-w-0 flex-1 truncate text-left text-sm after:absolute after:inset-0 after:rounded-lg",
                    first || last ? "font-medium" : "text-foreground/85",
                  )}
                >
                  {shortStationName(stop.name)}
                </button>
              )}
              {others.map((other) =>
                served.has(other.id) ? (
                  <button
                    key={other.id}
                    type="button"
                    onClick={() => view.selectLine(other.id)}
                    title={`Show ${other.name}`}
                    className="relative z-10 flex shrink-0 rounded-[5px] transition-opacity hover:opacity-80"
                  >
                    <LineBadge line={badgeLine(other)} size="xs" />
                  </button>
                ) : (
                  <LineBadge key={other.id} line={badgeLine(other)} size="xs" />
                ),
              )}
              {stop.type === "rail" && (
                <span title="Train station" className="flex shrink-0">
                  <OperatorTypeMarker type="passenger" className="size-4" />
                  <span className="sr-only">Train station</span>
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StopStripSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("px-3 pb-3", className)} aria-hidden>
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="flex">
          <div className="flex w-5 shrink-0 justify-center">
            <div className="w-1 bg-muted" />
          </div>
          <div className="ml-1 flex min-h-9 flex-1 items-center px-2.5">
            <Skeleton className="h-3.5" style={{ width: `${45 + ((index * 37) % 40)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
