import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { COUNTRY_MAP } from "@repo/data/countries";
import { Card, CardContent } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";
import { ArrowLeftIcon, ChevronRightIcon, ExpandIcon } from "lucide-react";

import { LineBadge } from "@/components/line-badge";
import { env } from "@/lib/env";
import { loadLinePage } from "@/lib/line-data.functions";
import type { DirectoryLine, LinePageData } from "@/lib/line-data.server";
import { metadataToHead } from "@/lib/metadata";
import { operatorTypeColors, operatorTypeLabels, OperatorTypeMarker } from "@/lib/operator-types";
import { staticAssetUrl } from "@/lib/static-assets";
import { prerenderedPageLinkProps, stationPageLinkProps } from "@/lib/station-prerender";

export const Route = createFileRoute("/lines/$id")({
  loader: async ({ params }) => {
    const data = await loadLinePage({ data: { id: params.id } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => metadataToHead(loaderData?.metadata ?? { title: "Line Not Found" }),
  component: LineRoute,
});

const markerType = { light: "light-rail", metro: "metro" } as const;

type Station = LinePageData["stations"][string];

function LineRoute() {
  const data = Route.useLoaderData();
  const [branch, setBranch] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const route = data.routes[branch]!;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:px-6 md:py-16">
      <Link
        to="/lines"
        {...prerenderedPageLinkProps}
        className="group/back mb-8 md:mb-12 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 transition-transform duration-150 ease-out group-hover/back:-translate-x-0.5" />
        All lines
      </Link>

      <Header data={data} />

      {/* Phones read map → stops → operator; desktops keep the map beside the stops. */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-6 md:sticky md:top-6 md:col-start-2 md:row-start-1 md:self-start">
          <LineMap data={data} route={route.stations} hovered={hovered} />
          <Stats data={data} />
          <div className="hidden space-y-6 md:block">
            <OperatorCard data={data} />
            <NetworkLines lines={data.network} />
          </div>
        </div>
        <div className="md:col-start-1 md:row-start-1">
          <BranchTabs data={data} branch={branch} onChange={setBranch} className="mb-3" />
          <StopList data={data} stations={route.stations} onHover={setHovered} />
        </div>
        <div className="space-y-6 md:hidden">
          <OperatorCard data={data} />
          <NetworkLines lines={data.network} />
        </div>
      </div>
    </div>
  );
}

function Header({ data }: { data: LinePageData }) {
  const { line } = data;
  const mode = markerType[line.type];
  const color = operatorTypeColors[mode];

  return (
    <div className="mb-10">
      <div className="flex items-start gap-5">
        <LineBadge line={line} size="xl" className="shadow-md" />
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            {line.name}
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            {line.routeCodes.length
              ? `Routes ${line.routeCodes.join(" / ")}`
              : line.loop
                ? `Circle line through ${line.from}`
                : `${line.from} – ${line.to}`}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Link
              to="/lines"
              search={{ type: line.type }}
              {...prerenderedPageLinkProps}
              className="inline-flex h-6 items-center gap-1.5 rounded-3xl py-0.5 pr-2.5 pl-1 text-xs font-medium transition-[filter] duration-150 hover:brightness-125"
              style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)` }}
            >
              <OperatorTypeMarker type={mode} className="size-4.5" />
              {operatorTypeLabels[mode]}
            </Link>
            <Link
              to="/lines"
              hash={line.country}
              {...prerenderedPageLinkProps}
              className="inline-flex h-6 items-center gap-1.5 rounded-3xl bg-muted/60 py-0.5 pr-2.5 pl-1 text-xs font-medium transition-colors duration-150 hover:bg-muted"
            >
              <img
                src={staticAssetUrl(`/flags/${line.country}.svg`)}
                alt=""
                width={18}
                height={18}
                className="size-4.5 rounded-full"
              />
              {COUNTRY_MAP[line.country]}
            </Link>
          </div>
        </div>
      </div>
      {data.description && (
        <p className="mt-8 text-[15px] leading-relaxed text-muted-foreground">{data.description}</p>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
      {children}
    </h2>
  );
}

function Stats({ data, className }: { data: LinePageData; className?: string }) {
  const interchanges = Object.values(data.stations).filter(
    (station) => station.rail || station.interchanges.length > 0,
  ).length;
  const stats = [
    { label: "Stations", value: Object.keys(data.stations).length },
    { label: "Interchanges", value: interchanges },
    data.routes.length > 1 && { label: "Branches", value: data.routes.length },
  ].filter(Boolean) as { label: string; value: string | number }[];

  return (
    <div
      className={cn("grid gap-3", className)}
      style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
    >
      {stats.map((stat) => (
        <Card key={stat.label} size="sm">
          <CardContent>
            <div className="text-xl font-semibold tracking-tight tabular-nums">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BranchTabs({
  data,
  branch,
  onChange,
  className,
}: {
  data: LinePageData;
  branch: number;
  onChange: (branch: number) => void;
  className?: string;
}) {
  if (data.routes.length < 2) return null;
  return (
    <div role="tablist" aria-label="Branches" className={cn("flex flex-wrap gap-1.5", className)}>
      {data.routes.map((route, index) => (
        <button
          key={index}
          type="button"
          role="tab"
          aria-selected={index === branch}
          onClick={() => onChange(index)}
          className={cn(
            "h-8 rounded-full px-3 text-xs font-medium ring-1 transition-colors duration-150",
            index === branch
              ? "bg-foreground text-background ring-foreground"
              : "bg-card text-muted-foreground ring-foreground/10 hover:text-foreground",
          )}
        >
          {route.code && <span className="mr-1.5 font-semibold">{route.code}</span>}
          {route.from} – {route.to}
        </button>
      ))}
    </div>
  );
}

/** The line's stops as a vertical strip map in its color. */
function StopList({
  data,
  stations,
  onHover,
  className,
}: {
  data: LinePageData;
  stations: string[];
  onHover: (id: string | null) => void;
  className?: string;
}) {
  const color = data.line.color;

  return (
    <ol className={className} onMouseLeave={() => onHover(null)}>
      {stations.map((id, index) => {
        const station = data.stations[id]!;
        const first = index === 0;
        const last = index === stations.length - 1;
        return (
          <li key={`${id}-${index}`} className="relative flex">
            <div className="relative flex w-6 shrink-0 justify-center" aria-hidden>
              <span
                className={cn(
                  "absolute w-1.5",
                  first ? "top-1/2" : "top-0",
                  last ? "bottom-1/2" : "bottom-0",
                )}
                style={{ backgroundColor: color }}
              />
              <span
                className={cn(
                  "relative self-center rounded-full bg-card",
                  first || last ? "size-4 border-4" : "size-3 border-[3px]",
                )}
                style={{ borderColor: color }}
              />
            </div>
            <Link
              to="/station/$id"
              params={{ id }}
              {...stationPageLinkProps(station)}
              onMouseEnter={() => onHover(id)}
              onFocus={() => onHover(id)}
              className="group ml-2 flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 transition-colors duration-150 lg:hover:bg-muted/60"
            >
              <span
                className={cn("min-w-0 flex-1 truncate text-sm", (first || last) && "font-medium")}
              >
                {station.name}
              </span>
              <Connections station={station} />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function Connections({ station }: { station: Station }) {
  if (!station.rail && station.interchanges.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-1">
      {station.interchanges.map((line) => (
        <LineBadge key={line.id} line={line} />
      ))}
      {station.rail && (
        <span title="Train station" className="flex">
          <OperatorTypeMarker type="passenger" className="size-5" />
          <span className="sr-only">Train station</span>
        </span>
      )}
    </span>
  );
}

/** The API's static map with the line drawn on top, fitted to the same bbox. */
function LineMap({
  data,
  route,
  hovered,
  className,
}: {
  data: LinePageData;
  route: string[];
  hovered: string | null;
  className?: string;
}) {
  const { map, line } = data;
  if (!map) return null;
  const onRoute = new Set(route);
  const termini = new Set([route[0], route.at(-1)]);

  return (
    <Link
      to="/"
      search={{ lat: map.view.lat, lng: map.view.lng, zoom: map.view.zoom }}
      className={cn("group/map block", className)}
    >
      <Card className="overflow-hidden py-0">
        <div className="relative aspect-4/3 bg-muted/40">
          <img
            loading="eager"
            src={`${env.apiUrl}/map/static?bbox=${map.bounds.join(",")}&w=${map.width}&h=${map.height}`}
            alt={`Map of ${line.name}`}
            className="absolute inset-0 size-full object-cover"
          />
          <svg
            viewBox={`0 0 ${map.width} ${map.height}`}
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 size-full"
            aria-hidden
          >
            {map.connections.map((connection) =>
              connection.paths.map((d, i) => (
                <path
                  key={`${connection.id}-${i}`}
                  d={d}
                  fill="none"
                  stroke={connection.color}
                  strokeOpacity={0.4}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )),
            )}
            {map.paths.map((d, i) => (
              <path
                key={`casing-${i}`}
                d={d}
                fill="none"
                stroke="#000"
                strokeOpacity={0.45}
                strokeWidth={9}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {map.paths.map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={line.color}
                strokeWidth={5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {map.stops.map((stop) => {
              const terminus = termini.has(stop.id);
              const active = hovered === stop.id;
              return (
                <circle
                  key={stop.id}
                  cx={stop.x}
                  cy={stop.y}
                  r={active ? 9 : terminus ? 6.5 : 4.5}
                  fill={active ? line.color : "#fff"}
                  stroke={active ? "#fff" : line.color}
                  strokeWidth={terminus || active ? 3.5 : 2.5}
                  opacity={onRoute.has(stop.id) ? 1 : 0.45}
                  className="transition-[r] duration-150"
                />
              );
            })}
          </svg>
          <ExpandIcon className="absolute top-4 right-4 size-4 text-muted-foreground opacity-0 scale-95 transition-[transform,opacity] duration-200 ease-out group-hover/map:opacity-100 group-hover/map:scale-100" />
        </div>
      </Card>
    </Link>
  );
}

function OperatorCard({ data }: { data: LinePageData }) {
  const { operator } = data.line;
  if (!operator) return null;
  return (
    <Link to="/operators/$slug" params={{ slug: operator.slug }} className="group block">
      <Card
        size="sm"
        className="transition-[background-color,box-shadow] duration-200 lg:group-hover:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] lg:group-hover:ring-foreground/20 dark:lg:group-hover:ring-foreground/20"
      >
        <CardContent className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-background">
            <img
              src={staticAssetUrl(`/operators/${operator.logoPath}.svg`)}
              alt=""
              width={40}
              height={40}
              className="size-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">Operated by</div>
            <div className="truncate text-sm font-medium tracking-tight">{operator.name}</div>
          </div>
          <ChevronRightIcon className="size-4 text-muted-foreground transition-transform duration-150 lg:group-hover:translate-x-0.5" />
        </CardContent>
      </Card>
    </Link>
  );
}

function NetworkLines({ lines }: { lines: DirectoryLine[] }) {
  if (lines.length === 0) return null;
  return (
    <Card size="sm" className="gap-0 py-0">
      <div className="px-4 pt-4 pb-2">
        <SectionTitle>Same network</SectionTitle>
      </div>
      <ul className="p-1.5 pt-0">
        {lines.map((line) => (
          <li key={line.id}>
            <Link
              to="/lines/$id"
              params={{ id: line.id }}
              {...prerenderedPageLinkProps}
              className="group flex items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors duration-150 lg:hover:bg-muted/60"
            >
              <LineBadge line={line} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {line.routeCodes.length
                  ? `${line.name} · ${line.routeCodes.join(" / ")}`
                  : line.loop
                    ? `Circle line via ${line.from}`
                    : `${line.from} – ${line.to}`}
              </span>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/60 transition-transform duration-150 lg:group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
