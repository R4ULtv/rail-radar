import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useHydrated, useNavigate } from "@tanstack/react-router";
import { metadataToHead, type Metadata } from "@/lib/metadata";
import { operators, type Operator, type OperatorType } from "@repo/data/operators";
import { COUNTRY_MAP, COUNTRY_CODES } from "@repo/data/countries";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@repo/ui/components/input-group";
import { Kbd } from "@repo/ui/components/kbd";
import { cn } from "@repo/ui/lib/utils";
import { ArrowLeftIcon, GlobeIcon, SearchIcon, XIcon } from "lucide-react";

import {
  isOperatorType,
  OPERATOR_TYPES,
  operatorTypeColors,
  operatorTypeLabels,
  OperatorTypeMarker,
  sortOperatorTypes,
} from "@/lib/operator-types";
import { svgDataUri } from "@/lib/station-marker-icons";
import { staticAssetUrl } from "@/lib/static-assets";

type OperatorsSearch = {
  type?: OperatorType;
  q?: string;
};

export const Route = createFileRoute("/operators/")({
  validateSearch: (search): OperatorsSearch => ({
    type: isOperatorType(search.type) ? search.type : undefined,
    q: typeof search.q === "string" && search.q.length > 0 ? search.q : undefined,
  }),
  head: () => metadataToHead(metadata),
  component: OperatorsPage,
});

const metadata: Metadata = {
  title: "Rail Operators - Trains, Metro & Light Rail",
  description:
    "Browse the rail, metro and light rail operators on Rail Radar, including Trenitalia, SBB, ATM Milano, VR, SNCB, and more. Find information about each operator, its lines, and services.",
  alternates: {
    canonical: "/operators",
  },
  openGraph: {
    images: [
      {
        url: "/assets/social/operators.webp",
        width: 1200,
        height: 630,
        alt: `Rail Radar - Rail operators across ${COUNTRY_CODES.length} countries`,
      },
    ],
  },
};

const serviceTypeLabels: Record<string, string> = {
  "high-speed": "High Speed",
  intercity: "Intercity",
  regional: "Regional",
  commuter: "Commuter",
  "night-train": "Night Train",
  international: "International",
  scenic: "Scenic",
};

const OPERATOR_GROUPS = ["international", ...COUNTRY_CODES] as const;

const operatorsByCountry = Object.fromEntries(
  Object.entries(
    operators.reduce<Record<string, Operator[]>>((acc, operator) => {
      for (const country of operator.countries) {
        (acc[country] ??= []).push(operator);
      }
      return acc;
    }, {}),
  ).map(([country, countryOperators]) => [
    country,
    countryOperators.sort(
      (a, b) => (b.countries[0] === country ? 1 : 0) - (a.countries[0] === country ? 1 : 0),
    ),
  ]),
);

function countByType(list: Operator[]): { type: OperatorType; count: number }[] {
  return OPERATOR_TYPES.map((type) => ({
    type,
    count: list.filter((operator) => operator.operatorTypes.includes(type)).length,
  })).filter(({ count }) => count > 0);
}

const typeCounts = countByType(operators);

/** Lowercase without accents, so "mobilita" finds "Brescia Mobilità". */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const searchIndex = new Map(
  operators.map((operator) => [
    operator.slug,
    normalize([operator.name, operator.parentCompany, operator.headquarters].join(" ")),
  ]),
);

function matchesQuery(operator: Operator, query: string): boolean {
  return !query || searchIndex.get(operator.slug)!.includes(query);
}

/** A neutral marker for "All operators", drawn like the map's (lucide layout-grid). */
const ALL_MARKER =
  svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 512 512">
  <rect width="464" height="464" x="24" y="24" fill="#57534e" stroke="#fff" stroke-width="48" paint-order="stroke" rx="112"/>
  <svg xmlns="http://www.w3.org/2000/svg" width="352" height="352" x="80" y="80" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
    <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
  </svg>
</svg>`);

function OperatorsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/operators/" });
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
  const matching = operators.filter((operator) => matchesQuery(operator, normalizedQuery));
  const matchingCounts = new Map(countByType(matching).map(({ type, count }) => [type, count]));
  const visible = matching.filter(
    (operator) => !selected || operator.operatorTypes.includes(selected),
  );

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
        <h1 className="text-4xl font-semibold tracking-tight">Rail Operators</h1>
        <p className="mt-3 text-muted-foreground max-w-lg text-pretty">
          {operators.length} rail, metro and light rail operators across {COUNTRY_CODES.length}{" "}
          countries on Rail Radar, with live tracking for passenger trains.
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
            placeholder="Search operators"
            aria-label="Search operators"
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

        <nav
          aria-label="Filter operators by mode"
          className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(var(--filters),minmax(0,1fr))]"
          style={{ "--filters": typeCounts.length + 1 } as React.CSSProperties}
        >
          <ModeFilter type={undefined} count={matching.length} selected={selected} />
          {typeCounts.map(({ type }) => (
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
        <div className="flex flex-col items-center gap-4 rounded-4xl border border-dashed border-foreground/10 px-6 py-12 text-center">
          <SearchIcon className="size-6 text-muted-foreground" />
          <div>
            <p className="font-medium tracking-tight">
              No {selected ? `${operatorTypeLabels[selected].toLowerCase()} ` : ""}operators match “
              {query.trim()}”
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try another name, a city, or a parent company such as Ferrovie dello Stato.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {selected && matching.length > 0 && (
              <Button
                variant="secondary"
                nativeButton={false}
                render={
                  <Link to="/operators" search={{ q: search.q }} replace resetScroll={false} />
                }
              >
                Show all modes ({matching.length})
              </Button>
            )}
            <Button variant="outline" onClick={() => updateQuery("")}>
              Clear search
            </Button>
          </div>
        </div>
      )}

      {normalizedQuery ? (
        visible.length > 0 && (
          // Searching lists each operator once, even when it runs in several countries.
          <section aria-label="Search results">
            <SectionHeader
              icon={<SearchIcon className="size-6 text-muted-foreground" />}
              title="Results"
              operators={visible}
              showModes={!selected}
            />
            <OperatorGrid operators={visible} />
          </section>
        )
      ) : (
        <div className="space-y-16">
          {OPERATOR_GROUPS.map((country) => {
            const countryOperators = operatorsByCountry[country]?.filter(
              (operator) => !selected || operator.operatorTypes.includes(selected),
            );
            if (!countryOperators?.length) return null;
            const isInternational = country === "international";
            const countryLabel = isInternational ? "International" : COUNTRY_MAP[country];

            return (
              <section key={country} id={country}>
                <SectionHeader
                  icon={
                    isInternational ? (
                      <GlobeIcon className="size-7 text-foreground" />
                    ) : (
                      <img
                        src={staticAssetUrl(`/flags/${country}.svg`)}
                        alt={countryLabel}
                        width={28}
                        height={28}
                        loading="lazy"
                        decoding="async"
                        className="size-7 rounded-full"
                      />
                    )
                  }
                  title={countryLabel}
                  operators={countryOperators}
                  showModes={!selected}
                />
                <OperatorGrid operators={countryOperators} />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  operators,
  showModes,
}: {
  icon: React.ReactNode;
  title: string;
  operators: Operator[];
  showModes: boolean;
}) {
  const modeCounts = countByType(operators);

  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex size-7 shrink-0 items-center justify-center">{icon}</div>
      <div className="shrink-0">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">
          {`${operators.length} operator${operators.length > 1 ? "s" : ""}`}
        </p>
      </div>
      <div className="h-px flex-1 ml-4 bg-muted" />
      {showModes && modeCounts.length > 1 && (
        <ul className="flex shrink-0 items-center gap-3 text-xs tabular-nums text-muted-foreground">
          {modeCounts.map(({ type, count }) => (
            <li key={type} className="flex items-center gap-1.5">
              <OperatorTypeMarker type={type} className="size-4" />
              {count}
              <span className="sr-only">{operatorTypeLabels[type]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OperatorGrid({ operators }: { operators: Operator[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {operators.map((operator) => (
        <OperatorCard key={operator.slug} operator={operator} />
      ))}
    </div>
  );
}

function ModeFilter({
  type,
  count,
  selected,
}: {
  type: OperatorType | undefined;
  count: number;
  selected: OperatorType | undefined;
}) {
  const isActive = type === selected;
  const color = type ? operatorTypeColors[type] : "var(--foreground)";

  return (
    <Link
      to="/operators"
      search={(prev) => ({ ...prev, type })}
      replace
      resetScroll={false}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-3xl bg-card p-3 shadow-md ring-1 ring-foreground/5 transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] dark:ring-foreground/10",
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
        <OperatorTypeMarker type={type} className="size-9" />
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
          {type ? operatorTypeLabels[type] : "All operators"}
        </div>
        <div className="text-xs tabular-nums text-muted-foreground">
          {count} operator{count === 1 ? "" : "s"}
        </div>
      </div>
    </Link>
  );
}

function OperatorCard({ operator }: { operator: Operator }) {
  const types = sortOperatorTypes(operator.operatorTypes);

  return (
    <Link to="/operators/$slug" params={{ slug: operator.slug }} className="group">
      <Card
        size="sm"
        className="h-full transition-[background-color,box-shadow,transform] ease-[cubic-bezier(0.23,1,0.32,1)] duration-200 lg:group-hover:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))] lg:group-hover:ring-foreground/20 dark:lg:group-hover:ring-foreground/20 group-active:scale-[0.98]"
      >
        <CardContent className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-background">
            <img
              src={staticAssetUrl(`/operators/${operator.logoPath}.svg`)}
              alt={operator.name}
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
              className="size-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 text-sm font-medium tracking-tight truncate lg:group-hover:text-foreground">
                {operator.name}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {types.map((type) => (
                  <span key={type} title={operatorTypeLabels[type]} className="flex">
                    <OperatorTypeMarker type={type} className="size-4.5" />
                  </span>
                ))}
                <span className="sr-only">
                  {types.map((type) => operatorTypeLabels[type]).join(", ")}
                </span>
              </div>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {operator.serviceTypes.slice(0, 2).map((type) => (
                <CardBadge key={type}>{serviceTypeLabels[type] ?? type}</CardBadge>
              ))}
              {operator.serviceTypes.length > 2 && (
                <span className="text-[10px] text-muted-foreground self-center">
                  +{operator.serviceTypes.length - 2}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CardBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="secondary" className="h-4.5 px-1.5 text-[10px] font-normal tabular-nums">
      {children}
    </Badge>
  );
}
