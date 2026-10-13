"use client";

import type { Line, LineRoute, Station } from "@repo/data";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { LineBadge } from "@/components/line-badge";
import { getLineBadgeCode, getLineColor } from "@/lib/line-colors";
import { OperatorTypeMarker } from "@/lib/operator-types";
import { prerenderedPageLinkProps } from "@/lib/station-prerender";
import { badgeLine, stopName, type StationLineView } from "./use-station-line-view";

/** "Metro · 2 lines", or what the panel is waiting for. */
export function StationLinesSummary({
  station,
  view,
}: {
  station: Station | null;
  view: StationLineView;
}) {
  if (!station) return null;
  const metro = station.type === "metro";
  const count = view.lines.length;
  return (
    <span className="flex items-center gap-1.5">
      <OperatorTypeMarker type={metro ? "metro" : "light-rail"} className="size-4" />
      {metro ? "Metro" : "Light rail"}
      {count > 0 && (
        <>
          <span aria-hidden>·</span>
          {count === 1 ? "1 line" : `${count} lines`}
        </>
      )}
    </span>
  );
}

/**
 * Chip labels without the words every line shares, so "Circumvesuviana Napoli–Sarno"
 * and "Circumvesuviana Napoli–Sorrento" read "Sarno" and "Sorrento", and "Metropolitana
 * M1" reads "M1". A label that only repeats the badge's code is dropped.
 */
function chipLabels(lines: readonly Line[]): Map<string, string | null> {
  const names = lines.map((line) => line.name);
  let prefix = names.length > 1 ? names[0]! : "";
  for (const name of names) {
    while (!name.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  // Cut back to a word boundary so a shared first letter doesn't get stripped.
  const cut = Math.max(...[" ", "–", "-", "/"].map((separator) => prefix.lastIndexOf(separator)));
  const strip = cut + 1;
  return new Map(
    lines.map((line) => {
      const label = line.name.slice(strip).trim() || line.name;
      return [line.id, label === getLineBadgeCode(line) ? null : label];
    }),
  );
}

/**
 * One chip per line serving the station, when there is more than one. Chips wrap on
 * desktop; in the drawer they scroll sideways to keep its header short.
 */
export function LinePicker({
  view,
  scroll = false,
  className,
}: {
  view: StationLineView;
  scroll?: boolean;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeId = view.line?.id;
  const labels = useMemo(() => chipLabels(view.lines), [view.lines]);

  useEffect(() => {
    const list = listRef.current;
    const chip = list?.querySelector<HTMLElement>("[aria-selected=true]");
    if (!scroll || !list || !chip) return;
    list.scrollLeft = chip.offsetLeft - (list.clientWidth - chip.offsetWidth) / 2;
  }, [activeId, scroll]);

  if (view.lines.length < 2) return null;

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Lines"
      className={cn(
        "flex gap-1.5",
        scroll
          ? "-ml-4 overflow-x-auto pl-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "flex-wrap",
        className,
      )}
    >
      {view.lines.map((line) => {
        const selected = line.id === activeId;
        const color = getLineColor(line);
        const label = labels.get(line.id);
        return (
          <button
            key={line.id}
            type="button"
            role="tab"
            aria-selected={selected}
            title={line.name}
            onClick={() => view.selectLine(line.id)}
            className={cn(
              "flex h-8 min-w-0 shrink-0 items-center gap-1.5 rounded-xl px-1.5 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              label && "pr-2.5",
              selected
                ? "text-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            style={
              selected
                ? {
                    backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`,
                    boxShadow: `inset 0 0 0 1.5px ${color}`,
                  }
                : undefined
            }
          >
            <LineBadge line={badgeLine(line)} />
            {label && <span className="max-w-32 truncate">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The shown branch at a glance, "Rho Fiera – Sesto 1° Maggio FS · 38 stops", with a
 * link to the line's page. A station with one line also gets its badge here.
 */
export function LineInfo({ view, className }: { view: StationLineView; className?: string }) {
  const { line, route } = view;
  if (!line) return null;
  const stations = line.routes[route]?.stations ?? [];
  const first = stations[0];
  const last = stations.at(-1);
  // The API can lack a stop of the bundled catalog (each deploys on its own), so the
  // termini can stay unnamed after the line loads.
  const named = !!first && !!last && !!view.stops[first] && !!view.stops[last];

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      {view.lines.length === 1 && <LineBadge line={badgeLine(line)} />}
      <div className="flex min-w-0 flex-1 text-xs text-muted-foreground">
        {named ? (
          <>
            <span className="truncate">
              {stopName(view, first)} – {stopName(view, last)}
            </span>
            <span className="shrink-0 whitespace-pre"> · {stations.length} stops</span>
          </>
        ) : view.isLoading ? (
          <Skeleton className="h-3 w-44" />
        ) : (
          line.name
        )}
      </div>
      <LinePageLink view={view} />
    </div>
  );
}

/** Link to the shown line's page. */
export function LinePageLink({ view, className }: { view: StationLineView; className?: string }) {
  if (!view.line) return null;
  return (
    <Button
      variant="ghost"
      size="xs"
      nativeButton={false}
      className={cn("-mr-2 shrink-0 text-muted-foreground", className)}
      render={
        <Link to="/lines/$id" params={{ id: view.line.id }} {...prerenderedPageLinkProps}>
          Line page
          <ArrowRightIcon />
        </Link>
      }
      aria-label={`Open the ${view.line.name} page`}
    />
  );
}

/**
 * Branch labels that say where each one goes: when every branch starts (or ends) at
 * the same stop, only the other end tells them apart, and branches that each end
 * somewhere else read as their destination.
 */
function branchLabel(view: StationLineView, routes: LineRoute[], route: LineRoute): string {
  const firsts = new Set(routes.map((other) => other.stations[0]));
  const lasts = new Set(routes.map((other) => other.stations.at(-1)));
  const first = stopName(view, route.stations[0]);
  const last = stopName(view, route.stations.at(-1));
  if (firsts.size === 1 && lasts.size === routes.length) return last;
  if (lasts.size === 1 && firsts.size === routes.length) return first;
  if (lasts.size === routes.length) return `To ${last}`;
  return `${first} – ${last}`;
}

/** The shown line's branches through the station, when there is more than one. */
export function BranchPicker({ view, className }: { view: StationLineView; className?: string }) {
  if (!view.line || view.routes.length < 2) return null;
  const all = view.line.routes;
  const routes = view.routes.map((index) => all[index]!);
  const named = routes.every((route) =>
    [route.stations[0], route.stations.at(-1)].every((id) => !!id && !!view.stops[id]),
  );

  return (
    <div
      role="tablist"
      aria-label="Branches"
      className={cn("flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1", className)}
    >
      {view.routes.map((index, position) => {
        const route = all[index]!;
        const selected = index === view.route;
        return (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => view.selectRoute(index)}
            className={cn(
              "flex h-7 min-w-0 flex-1 basis-24 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              selected
                ? "bg-card text-foreground shadow-sm ring-1 ring-foreground/5 dark:bg-input/60"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {route.code && <span className="shrink-0 font-semibold">{route.code}</span>}
            {named ? (
              <span className="truncate">{branchLabel(view, routes, route)}</span>
            ) : view.isLoading ? (
              <Skeleton className="h-3 w-16" />
            ) : (
              !route.code && `Branch ${position + 1}`
            )}
          </button>
        );
      })}
    </div>
  );
}
