"use client";

import * as React from "react";
import {
  BookmarkIcon,
  HistoryIcon,
  ListIcon,
  SearchIcon,
  SearchXIcon,
  SquareMIcon,
  TrainFrontIcon,
  TramFrontIcon,
  TrendingUpIcon,
  XIcon,
  UserIcon,
} from "lucide-react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";
import { parseAsString, useQueryState } from "nuqs";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@repo/ui/components/drawer";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@repo/ui/components/input-group";
import { Spinner } from "@repo/ui/components/spinner";
import { Kbd } from "@repo/ui/components/kbd";

import { useAnimatedHeight } from "@/hooks/use-animated-height";
import { useDebounce } from "@repo/ui/hooks/use-debounce";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import { useSelectedStation } from "@/hooks/use-selected-station";
import { useStationSearch } from "@/hooks/use-station-search";
import { useTrendingStations } from "@/hooks/use-trending-stations";

import { cn } from "@repo/ui/lib/utils";
import { getCountry } from "@repo/data/countries";
import type { Station } from "@repo/data";
import Image from "next/image";
import { Button } from "@repo/ui/components/button";

const StationList = React.memo(function StationList({
  stations,
  onSelect,
  focusedIndex = -1,
  startIndex = 0,
  onFocusIndex,
  counts,
}: {
  stations: Station[];
  onSelect: (station: Station) => void;
  focusedIndex?: number;
  startIndex?: number;
  onFocusIndex?: (index: number) => void;
  counts?: Map<string, { visits: number; uniqueVisitors: number }>;
}) {
  if (stations.length === 0) return null;

  return (
    <ul role="listbox" className="flex flex-col">
      {stations.map((station, index) => {
        const globalIndex = startIndex + index;
        const isFocused = globalIndex === focusedIndex;
        const stationCounts = counts?.get(station.id);

        return (
          <li
            key={station.id}
            id={`station-option-${station.id}`}
            role="option"
            aria-selected={isFocused}
          >
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(station)}
              onMouseEnter={() => onFocusIndex?.(globalIndex)}
              onMouseLeave={() => onFocusIndex?.(-1)}
              tabIndex={-1}
              className={cn(
                "w-full px-4 py-2.5 md:py-2 text-left text-sm transition-colors duration-75 ease-out flex items-center gap-2",
                isFocused && "bg-muted",
              )}
            >
              {station.type === "metro" ? (
                <SquareMIcon className="size-4 text-muted-foreground" />
              ) : station.type === "light" ? (
                <TramFrontIcon className="size-4 text-muted-foreground" />
              ) : (
                <TrainFrontIcon className="size-4 text-muted-foreground" />
              )}
              <span className="max-w-75 md:max-w-61 truncate">{station.name}</span>
              <Image
                unoptimized
                src={`/flags/${getCountry(station.id) ?? "xx"}.svg`}
                alt={getCountry(station.id)?.toUpperCase() ?? ""}
                className="size-3 shrink-0 rounded-full object-cover"
                width={12}
                height={12}
              />
              {stationCounts && (
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums ml-auto flex items-center gap-1">
                  <UserIcon className="size-3.5" />
                  {stationCounts.uniqueVisitors.toLocaleString()} (
                  {stationCounts.visits.toLocaleString()})
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
});

function SearchContent({
  isSearchActive,
  searchResults,
  noResults,
  showDefaultLists,
  filteredRecentStations,
  savedStations,
  trendingStations,
  trendingCounts,
  handleSelectStation,
  focusedIndex,
  setFocusedIndex,
  limit,
}: {
  isSearchActive: boolean;
  searchResults: Station[];
  noResults: boolean;
  showDefaultLists: boolean;
  filteredRecentStations: Station[];
  savedStations: Station[];
  trendingStations: Station[];
  trendingCounts: Map<string, { visits: number; uniqueVisitors: number }>;
  handleSelectStation: (station: Station) => void;
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
  limit?: number;
}) {
  return (
    <>
      {/* Search Results */}
      {isSearchActive && searchResults.length > 0 && (
        <>
          <div className="px-4 py-2 not-first:mt-1">
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <ListIcon className="size-3.5" />
              Search Results
            </p>
          </div>
          <StationList
            stations={limit ? searchResults.slice(0, limit) : searchResults}
            onSelect={handleSelectStation}
            focusedIndex={focusedIndex}
            startIndex={0}
            onFocusIndex={setFocusedIndex}
          />
        </>
      )}
      {/* No Results */}
      {noResults && (
        <div className="px-4 py-3 flex items-center gap-3 text-muted-foreground">
          <SearchXIcon className="size-5 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-foreground">No stations found</p>
            <p className="text-xs">Try a different search term</p>
          </div>
        </div>
      )}
      {/* Recent Stations */}
      {showDefaultLists && filteredRecentStations.length > 0 && (
        <>
          <div className="px-4 py-2 not-first:mt-1">
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <HistoryIcon className="size-3.5" />
              Recent Stations
            </p>
          </div>
          <StationList
            stations={filteredRecentStations}
            onSelect={handleSelectStation}
            focusedIndex={focusedIndex}
            startIndex={0}
            onFocusIndex={setFocusedIndex}
          />
        </>
      )}
      {/* Saved Stations */}
      {showDefaultLists && savedStations.length > 0 && (
        <>
          <div className="px-4 py-2 not-first:mt-1">
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <BookmarkIcon className="size-3.5" />
              Saved Stations
            </p>
          </div>
          <StationList
            stations={savedStations}
            onSelect={handleSelectStation}
            focusedIndex={focusedIndex}
            startIndex={filteredRecentStations.length}
            onFocusIndex={setFocusedIndex}
          />
        </>
      )}
      {/* Trending Stations */}
      {showDefaultLists && trendingStations.length > 0 && (
        <>
          <div className="px-4 py-2 not-first:mt-1">
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <TrendingUpIcon className="size-3.5" />
              Trending Stations
            </p>
          </div>
          <StationList
            stations={trendingStations}
            onSelect={handleSelectStation}
            focusedIndex={focusedIndex}
            startIndex={filteredRecentStations.length + savedStations.length}
            onFocusIndex={setFocusedIndex}
            counts={trendingCounts}
          />
        </>
      )}
    </>
  );
}

export function Search() {
  const isMobile = useIsMobile();
  const { selectStation, savedStations, recentStations } = useSelectedStation();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [urlQuery, setUrlQuery] = useQueryState(
    "q",
    parseAsString.withDefault("").withOptions({
      history: "replace",
      shallow: true,
    }),
  );
  // Local state for responsive input, initialized from URL for shareability
  const [query, setQuery] = React.useState(urlQuery);
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebounce(trimmedQuery, 250);
  const hasMinimumSearchLength = trimmedQuery.length >= 2;
  const searchQuery = debouncedQuery.length >= 2 ? debouncedQuery : null;

  // Sync debounced query to URL
  React.useEffect(() => {
    setUrlQuery(debouncedQuery || null);
  }, [debouncedQuery, setUrlQuery]);
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);
  const previousListStateRef = React.useRef({ query, resultsLength: 0 });
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(() => isMobile && query.length > 0);

  // Fetch search results
  const { stations: searchResultsRaw, isLoading } = useStationSearch(searchQuery);
  const searchResults = searchResultsRaw;

  // Fetch trending stations
  const { data: trendingData } = useTrendingStations("week");

  const { trendingStations, trendingCounts } = React.useMemo(() => {
    if (!trendingData?.stations) {
      return {
        trendingStations: [] as Station[],
        trendingCounts: new Map<string, { visits: number; uniqueVisitors: number }>(),
      };
    }
    const stations: Station[] = trendingData.stations.map((s) => ({
      id: s.stationId,
      name: s.stationName,
      type: s.type,
      importance: s.importance,
      geo: s.geo ?? undefined,
    }));
    const counts = new Map(
      trendingData.stations.map((s) => [
        s.stationId,
        { visits: s.visits, uniqueVisitors: s.uniqueVisitors },
      ]),
    );
    return { trendingStations: stations, trendingCounts: counts };
  }, [trendingData]);

  const isSearchActive = trimmedQuery.length > 0;
  const isSearchResultsActive = isSearchActive && hasMinimumSearchLength;
  const isSearchReady = hasMinimumSearchLength && trimmedQuery === debouncedQuery;
  const hasSearched = isSearchActive && isSearchReady && !isLoading;

  const noResults = hasSearched && searchResults.length === 0;
  const showDefaultLists =
    !isSearchActive || !hasMinimumSearchLength || noResults || (isSearchActive && !hasSearched);
  const showSearchSpinner = hasMinimumSearchLength && !hasSearched;
  const showSearchContent = !isSearchActive || !hasMinimumSearchLength || hasSearched;

  const cardHeight = useAnimatedHeight();

  const handleSelectStation = React.useCallback(
    (station: Station) => {
      selectStation(station);
      if (isMobile) {
        setIsDrawerOpen(false);
        setQuery("");
      } else {
        inputRef.current?.blur();
        setQuery("");
      }
    },
    [selectStation, isMobile, setQuery],
  );

  // Filter recent stations to exclude those already in saved stations.
  const filteredRecentStations = React.useMemo(() => {
    const savedIds = new Set(savedStations.map((s) => s.id));
    return recentStations.filter((s) => !savedIds.has(s.id));
  }, [recentStations, savedStations]);

  const visibleStations = React.useMemo(() => {
    if (isSearchResultsActive && searchResults.length > 0) {
      return searchResults.slice(0, 10);
    }
    if (!isSearchResultsActive || noResults) {
      return [...filteredRecentStations, ...savedStations, ...trendingStations];
    }
    return [];
  }, [
    isSearchResultsActive,
    searchResults,
    filteredRecentStations,
    savedStations,
    noResults,
    trendingStations,
  ]);

  const focusedIndexRef = React.useRef(focusedIndex);
  const visibleStationsRef = React.useRef(visibleStations);

  React.useEffect(() => {
    focusedIndexRef.current = focusedIndex;
    visibleStationsRef.current = visibleStations;
  });

  const previousListState = previousListStateRef.current;
  if (
    query !== previousListState.query ||
    searchResults.length !== previousListState.resultsLength
  ) {
    previousListStateRef.current = { query, resultsLength: searchResults.length };
    if (focusedIndex !== -1) {
      setFocusedIndex(-1);
    }
  }

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl+K to toggle focus
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (document.activeElement === inputRef.current) {
          inputRef.current?.blur();
        } else {
          inputRef.current?.focus();
        }
        return;
      }

      // Escape to blur
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
        return;
      }

      // Arrow/Enter navigation only when input is focused
      if (document.activeElement !== inputRef.current) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          if (visibleStationsRef.current.length === 0) return -1;
          if (prev < visibleStationsRef.current.length - 1) return prev + 1;
          return prev;
        });
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          if (prev > 0) return prev - 1;
          return 0;
        });
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const station = visibleStationsRef.current[focusedIndexRef.current];
        if (station) {
          handleSelectStation(station);
        }
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSelectStation]);

  React.useEffect(() => {
    if (isMobile && isDrawerOpen) {
      inputRef.current?.focus();
    }
  }, [isMobile, isDrawerOpen]);

  const searchContentProps = {
    isSearchActive: isSearchResultsActive,
    searchResults,
    noResults,
    showDefaultLists,
    filteredRecentStations,
    savedStations,
    trendingStations,
    trendingCounts,
    handleSelectStation,
    focusedIndex,
    setFocusedIndex,
  };

  // Mobile view - trigger input + full-screen drawer
  if (isMobile) {
    return (
      <LazyMotion features={domAnimation}>
        <div className="absolute z-50 top-4 right-4 left-4 font-sans">
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Search stations"
            className="bg-card text-muted-foreground hover:bg-muted dark:bg-card dark:hover:bg-muted w-full justify-start active:scale-[0.98] transition-transform duration-100"
          >
            <SearchIcon className="text-muted-foreground" />
            <span className="flex-1 text-left">Search…</span>
            {savedStations.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                {savedStations.length}
                <BookmarkIcon className="size-3.5" />
              </span>
            )}
          </Button>
        </div>

        {/* Full-screen search drawer */}
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerContent className="h-full data-[swipe-direction=down]:max-h-svh -mx-px outline-none bg-card data-[swipe-direction=down]:mt-0 data-[swipe-direction=down]:rounded-none data-[swipe-direction=down]:border-t-0">
            <DrawerHeader className="pb-0">
              <DrawerTitle className="sr-only">Search Stations</DrawerTitle>
              <DrawerDescription className="sr-only">
                Search and select a train station from the list
              </DrawerDescription>
              <InputGroup className="h-10 bg-background">
                <InputGroupInput
                  ref={inputRef}
                  placeholder="Search..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  name="search"
                  autoComplete="off"
                  aria-label="Search stations"
                />
                <InputGroupAddon>
                  {showSearchSpinner ? <Spinner /> : <SearchIcon />}
                </InputGroupAddon>
                <AnimatePresence>
                  {isSearchActive && (
                    <m.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                    >
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          aria-label="Clear search"
                          title="Clear search"
                          size="icon-xs"
                          onClick={() => setQuery("")}
                        >
                          <XIcon />
                        </InputGroupButton>
                      </InputGroupAddon>
                    </m.div>
                  )}
                </AnimatePresence>
              </InputGroup>
            </DrawerHeader>

            <div className="flex-1 overflow-auto pt-2">
              {showSearchContent && <SearchContent {...searchContentProps} />}
            </div>
          </DrawerContent>
        </Drawer>
      </LazyMotion>
    );
  }

  // Desktop view - floating card with dropdown
  return (
    <LazyMotion features={domAnimation}>
      <div className="absolute z-50 top-4 left-4 flex flex-col gap-2 md:w-80 w-[calc(100svw-32px)] pointer-events-none font-sans">
        <InputGroup className="h-9 bg-card dark:bg-card pointer-events-auto">
          <InputGroupInput
            ref={inputRef}
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => setFocusedIndex(-1)}
            name="search"
            autoComplete="off"
            role="combobox"
            aria-label="Search..."
            aria-expanded={visibleStations.length > 0}
            aria-haspopup="listbox"
            aria-controls="station-listbox"
            aria-activedescendant={
              focusedIndex >= 0 && visibleStations[focusedIndex]
                ? `station-option-${visibleStations[focusedIndex].id}`
                : undefined
            }
          />
          <InputGroupAddon>{showSearchSpinner ? <Spinner /> : <SearchIcon />}</InputGroupAddon>
          {isSearchActive ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label="Clear search"
                title="Clear search"
                size="icon-xs"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setQuery("")}
              >
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          ) : (
            <InputGroupAddon align="inline-end">
              <Kbd>⌘K</Kbd>
            </InputGroupAddon>
          )}
        </InputGroup>
        <AnimatePresence>
          {showSearchContent && (
            <m.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
              style={{ height: cardHeight.height }}
              className="rounded-md pointer-events-auto overflow-hidden"
            >
              <div
                ref={cardHeight.contentRef}
                className="bg-card border border-input text-card-foreground rounded-md py-2 shadow-xs flex flex-col"
              >
                <div>
                  <SearchContent {...searchContentProps} limit={10} />
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
}
