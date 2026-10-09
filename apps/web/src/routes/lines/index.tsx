import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useHydrated, useNavigate } from "@tanstack/react-router";
import { COUNTRY_CODES, COUNTRY_MAP, type CountryCode } from "@repo/data/countries";
import { Card } from "@repo/ui/components/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@repo/ui/components/input-group";
import { Kbd } from "@repo/ui/components/kbd";
import { cn } from "@repo/ui/lib/utils";
import { ArrowLeftIcon, ChevronRightIcon, SearchIcon, XIcon } from "lucide-react";

import { LineBadge } from "@/components/line-badge";
import { metadataToHead } from "@/lib/metadata";
import { loadLinesDirectoryPage } from "@/lib/line-data.functions";
import type { DirectoryLine } from "@/lib/line-data.server";
import { operatorTypeColors, operatorTypeLabels, OperatorTypeMarker } from "@/lib/operator-types";
import { svgDataUri } from "@/lib/station-marker-icons";
import { staticAssetUrl } from "@/lib/static-assets";
import { prerenderedPageLinkProps } from "@/lib/station-prerender";

type LineType = DirectoryLine["type"];
const LINE_TYPES = ["light", "metro"] as const satisfies readonly LineType[];
/** Lines use the station vocabulary ("light"); markers and colors use the operator one. */
const markerType = { light: "light-rail", metro: "metro" } as const;

type LinesSearch = {
  type?: LineType;
  q?: string;
};

export const Route = createFileRoute("/lines/")({
  validateSearch: (search): LinesSearch => ({
    type: LINE_TYPES.includes(search.type as LineType) ? (search.type as LineType) : undefined,
    q: typeof search.q === "string" && search.q.length > 0 ? search.q : undefined,
  }),
  loader: () => loadLinesDirectoryPage(),
  head: ({ loaderData }) =>
    metadataToHead(loaderData?.metadata ?? { title: "Metro & Light Rail Lines" }),
  component: LinesPage,
});

/** Lowercase without accents, so "mollers" finds "Aksel Møllers Have". */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function searchText(line: DirectoryLine): string {
  return normalize(
    [
      line.code,
      ...line.routeCodes,
      line.name,
      line.operator?.name,
      line.from,
      line.to,
      COUNTRY_MAP[line.country],
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }
  return groups;
}

function countByType(lines: readonly DirectoryLine[]): { type: LineType; count: number }[] {
  return LINE_TYPES.map((type) => ({
    type,
    count: lines.filter((line) => line.type === type).length,
  })).filter(({ count }) => count > 0);
}

/** Lines without an operator form a network of their own. */
function networkKey(line: DirectoryLine): string {
  return line.operator?.slug ?? line.id;
}

/** A neutral marker for "All lines", drawn like the map's (lucide layout-grid). */
const ALL_MARKER =
  svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 512 512">
  <rect width="464" height="464" x="24" y="24" fill="#57534e" stroke="#fff" stroke-width="48" paint-order="stroke" rx="112"/>
  <svg xmlns="http://www.w3.org/2000/svg" width="352" height="352" x="80" y="80" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
    <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
  </svg>
</svg>`);

function LinesPage() {
  const { lines, networkStations } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/lines/" });
  // The page is prerendered without a query string, so the filters apply after hydration.
  const hydrated = useHydrated();
  const selected = hydrated ? search.type : undefined;
  // Typing stays local so the caret never waits on navigation; the URL follows along.
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hydrated) setQuery(search.q ?? "");
    // Only seed from the URL once; afterwards the input is the source of truth.
  }, [hydrated]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const updateQuery = (value: string) => {
    setQuery(value);
    void navigate({
      search: (prev) => ({ ...prev, q: value || undefined }),
      replace: true,
      resetScroll: false,
    });
  };

  const normalizedQuery = normalize(query);
  const matching = lines.filter(
    (line) => !normalizedQuery || searchText(line).includes(normalizedQuery),
  );
  const matchingCounts = new Map(countByType(matching).map(({ type, count }) => [type, count]));
  const visible = matching.filter((line) => !selected || line.type === selected);
  const byCountry = groupBy(visible, (line) => line.country);
  const lineCountries = new Set(lines.map((line) => line.country)).size;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 md:px-6 md:py-16">
      <Link
        to="/"
        className="group/back mb-8 md:mb-12 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 transition-transform duration-150 ease-out group-hover/back:-translate-x-0.5" />
        Back to Rail Radar
      </Link>

      <div className="mb-10">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-3">
          Directory
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Lines</h1>
        <p className="mt-3 text-muted-foreground max-w-lg text-pretty">
          {lines.length} metro and light rail lines across {lineCountries} countries, with their
          stations, termini and operators.
        </p>
      </div>

      <div className="mb-16 space-y-3">
        <InputGroup className="h-12 bg-card shadow-md ring-1 ring-foreground/5 dark:bg-card dark:ring-foreground/10">
          <InputGroupAddon className="pl-4">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                if (query) updateQuery("");
                else event.currentTarget.blur();
              }
            }}
            placeholder="Search lines, stations or operators"
            aria-label="Search lines"
            autoComplete="off"
            spellCheck={false}
            className="text-[15px] [&::-webkit-search-cancel-button]:hidden"
          />
          <InputGroupAddon align="inline-end" className="pr-4">
            {query ? (
              <InputGroupButton
                size="icon-xs"
                aria-label="Clear search"
                title="Clear search"
                onClick={() => {
                  updateQuery("");
                  inputRef.current?.focus();
                }}
              >
                <XIcon />
              </InputGroupButton>
            ) : (
              <Kbd className="hidden md:inline-flex">⌘K</Kbd>
            )}
          </InputGroupAddon>
        </InputGroup>

        <nav aria-label="Filter lines by mode" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ModeFilter type={undefined} count={matching.length} selected={selected} />
          {LINE_TYPES.map((type) => (
            <ModeFilter
              key={type}
              type={type}
              count={matchingCounts.get(type) ?? 0}
              selected={selected}
            />
          ))}
        </nav>
      </div>

      {visible.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-4xl border border-dashed border-foreground/10 px-6 py-12 text-center">
          <SearchIcon className="size-6 text-muted-foreground" />
          <div>
            <p className="font-medium tracking-tight">No lines match “{query.trim()}”</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a line code, a station, or an operator such as ATM.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-16">
        {COUNTRY_CODES.map((country) => {
          const countryLines = byCountry.get(country);
          if (!countryLines) return null;
          // Biggest networks first; the columns then pack each card at its own height.
          const networks = [...groupBy(countryLines, networkKey).values()].sort(
            (a, b) => b.length - a.length,
          );

          return (
            <section key={country} id={country}>
              <CountryHeader country={country} lines={countryLines} showModes={!selected} />
              <div className="columns-1 gap-3 md:columns-2">
                {networks.map((networkLines) => {
                  const counts = networkStations[networkKey(networkLines[0]!)]!;
                  return (
                    <NetworkCard
                      key={networkKey(networkLines[0]!)}
                      lines={networkLines}
                      stations={counts[selected ?? "all"]}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function CountryHeader({
  country,
  lines,
  showModes,
}: {
  country: CountryCode;
  lines: DirectoryLine[];
  showModes: boolean;
}) {
  const modeCounts = countByType(lines);

  return (
    <div className="flex items-center gap-3 mb-6">
      <img
        src={staticAssetUrl(`/flags/${country}.svg`)}
        alt=""
        width={28}
        height={28}
        loading="lazy"
        decoding="async"
        className="size-7 rounded-full"
      />
      <div className="shrink-0">
        <h2 className="text-lg font-semibold tracking-tight">{COUNTRY_MAP[country]}</h2>
        <p className="text-xs text-muted-foreground">
          {`${lines.length} line${lines.length === 1 ? "" : "s"}`}
        </p>
      </div>
      <div className="h-px flex-1 ml-4 bg-muted" />
      {showModes && modeCounts.length > 1 && (
        <ul className="flex shrink-0 items-center gap-3 text-xs tabular-nums text-muted-foreground">
          {modeCounts.map(({ type, count }) => (
            <li key={type} className="flex items-center gap-1.5">
              <OperatorTypeMarker type={markerType[type]} className="size-4" />
              {count}
              <span className="sr-only">{operatorTypeLabels[markerType[type]]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One operator's lines, like a transit map legend. */
function NetworkCard({ lines, stations }: { lines: DirectoryLine[]; stations: number }) {
  const operator = lines[0]!.operator;

  return (
    <Card size="sm" className="mb-3 gap-0 break-inside-avoid py-0">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        {operator && (
          <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background">
            <img
              src={staticAssetUrl(`/operators/${operator.logoPath}.svg`)}
              alt=""
              width={32}
              height={32}
              loading="lazy"
              decoding="async"
              className="size-full object-contain"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium tracking-tight">
            {operator?.name ?? lines[0]!.name}
          </div>
          <div className="text-xs tabular-nums text-muted-foreground">
            {lines.length} line{lines.length === 1 ? "" : "s"} · {stations} station
            {stations === 1 ? "" : "s"}
          </div>
        </div>
      </div>
      <ul className="border-t border-foreground/5 p-1.5">
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
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {line.stations}
                <span className="sr-only"> stations</span>
              </span>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/60 transition-transform duration-150 lg:group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ModeFilter({
  type,
  count,
  selected,
}: {
  type: LineType | undefined;
  count: number;
  selected: LineType | undefined;
}) {
  const isActive = type === selected;
  const color = type ? operatorTypeColors[markerType[type]] : "var(--foreground)";

  return (
    <Link
      from="/lines/"
      to="/lines"
      search={(prev) => ({ ...prev, type })}
      replace
      resetScroll={false}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-3xl bg-card p-3 shadow-md ring-1 ring-foreground/5 transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] dark:ring-foreground/10",
        // On phones "All lines" takes the top row and the two modes share the one below.
        !type && "col-span-2 sm:col-span-1",
        !isActive &&
          "lg:hover:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] lg:hover:ring-foreground/20 dark:lg:hover:ring-foreground/20",
        count === 0 && !isActive && "opacity-50",
      )}
      style={
        isActive
          ? {
              backgroundColor: `color-mix(in oklab, ${color} 14%, var(--card))`,
              boxShadow: `0 0 0 2px ${color}`,
            }
          : undefined
      }
    >
      {type ? (
        <OperatorTypeMarker type={markerType[type]} className="size-9" />
      ) : (
        <img
          src={ALL_MARKER}
          alt=""
          width={36}
          height={36}
          draggable={false}
          className="size-9 shrink-0 select-none"
        />
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium tracking-tight">
          {type ? operatorTypeLabels[markerType[type]] : "All lines"}
        </div>
        <div className="text-xs tabular-nums text-muted-foreground">
          {count} line{count === 1 ? "" : "s"}
        </div>
      </div>
    </Link>
  );
}
