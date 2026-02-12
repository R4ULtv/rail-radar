"use client";

import * as React from "react";
import {
  BookmarkIcon,
  ListIcon,
  SearchIcon,
  SearchXIcon,
  SquareMIcon,
  TrainFrontIcon,
  TrendingUpIcon,
  XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

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

import { useAnimatedHeight } from "@/hooks/use-animated-height";
import { useDebounce } from "@repo/ui/hooks/use-debounce";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import { useSelectedStation } from "@/hooks/use-selected-station";
import { useStationSearch } from "@/hooks/use-station-search";
import { useTrendingStations } from "@/hooks/use-trending-stations";

import { cn } from "@repo/ui/lib/utils";
import type { Station } from "@repo/data";

const StationList = React.memo(function StationList({
  stations,
  onSelect,
  focusedIndex = -1,
  startIndex = 0,
  onFocusIndex,
  visits,
}: {
  stations: Station[];
  onSelect: (station: Station) => void;
  focusedIndex?: number;
  startIndex?: number;
  onFocusIndex?: (index: number) => void;
  visits?: Map<string, number>;
}) {
  if (stations.length === 0) return null;

  return (
    <ul role="listbox" className="flex flex-col">
      {stations.map((station, index) => {
        const globalIndex = startIndex + index;
        const isFocused = globalIndex === focusedIndex;
        const visitCount = visits?.get(station.id);

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
              ) : (
                <TrainFrontIcon className="size-4 text-muted-foreground" />
              )}
              <span className={cn(visitCount !== undefined && "flex-1")}>
                {station.name}
              </span>
              {visitCount !== undefined && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {visitCount}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
});

export function Search() {
  const isMobile = useIsMobile();
  const { selectStation, savedStations } = useSelectedStation();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebounce(query.trim(), 300);
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  // Fetch search results
  const { stations: searchResults, isLoading } = useStationSearch(
    debouncedQuery || null,
  );

  // Fetch trending stations
  const { data: trendingData } = useTrendingStations("week");

  const { trendingStations, trendingVisits } = React.useMemo(() => {
    if (!trendingData?.stations) {
      return {
        trendingStations: [] as Station[],
        trendingVisits: new Map<string, number>(),
      };
    }
    const stations: Station[] = trendingData.stations.map((s) => ({
      id: s.stationId,
      name: s.stationName,
      type: "rail" as const,
      importance: 4 as const,
    }));
    const visits = new Map(
      trendingData.stations.map((s) => [s.stationId, s.visits]),
    );
    return { trendingStations: stations, trendingVisits: visits };
  }, [trendingData]);

  const isSearchActive = query.trim().length > 0;
  const hasSearched =
    isSearchActive && query.trim() === debouncedQuery && !isLoading;

  const noResults = isSearchActive && hasSearched && searchResults.length === 0;
  const showDefaultLists =
    !isSearchActive || noResults || (isSearchActive && !hasSearched);

  const cardHeight = useAnimatedHeight();

  const handleSelectStation = React.useCallback(
    (station: Station) => {
      selectStation(station);
      if (isMobile) {
        setIsDrawerOpen(false);
        setQuery("");
      } else {
        inputRef.current?.blur();
      }
    },
    [selectStation, isMobile],
  );

  const visibleStations = React.useMemo(() => {
    if (isSearchActive && searchResults.length > 0) {
      return searchResults.slice(0, 10);
    }
    if (!isSearchActive || noResults) {
      return [...savedStations, ...trendingStations];
    }
    return [];
  }, [
    isSearchActive,
    searchResults,
    savedStations,
    noResults,
    trendingStations,
  ]);

  const focusedIndexRef = React.useRef(focusedIndex);
  const visibleStationsRef = React.useRef(visibleStations);

  focusedIndexRef.current = focusedIndex;
  visibleStationsRef.current = visibleStations;

  // Reset focused index when list changes
  React.useEffect(() => {
    setFocusedIndex(-1);
  }, [query, searchResults.length]);

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

  // Search content shared between desktop dropdown and mobile drawer
  const renderSearchContent = (limit?: number) => (
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
            <p className="text-sm font-medium text-foreground">
              No stations found
            </p>
            <p className="text-xs">Try a different search term</p>
          </div>
        </div>
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
            startIndex={0}
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
            startIndex={savedStations.length}
            onFocusIndex={setFocusedIndex}
            visits={trendingVisits}
          />
        </>
      )}
    </>
  );

  // Mobile view - trigger input + full-screen drawer
  if (isMobile) {
    return (
      <>
        {/* Trigger input on the map */}
        <div className="absolute z-50 top-4 left-4 w-[calc(100vw-32px)] pointer-events-none font-sans">
          <InputGroup
            className="h-10 bg-card dark:bg-card pointer-events-auto cursor-pointer focus-within:ring-2 focus-within:ring-ring"
            onClick={() => setIsDrawerOpen(true)}
          >
            <InputGroupInput
              placeholder="Search Station..."
              value=""
              readOnly
              name="search-trigger"
              aria-label="Search stations"
              className="cursor-pointer"
              onFocus={(e) => {
                e.target.blur();
                setIsDrawerOpen(true);
              }}
              onChange={() => {}}
            />
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
          </InputGroup>
        </div>

        {/* Full-screen search drawer */}
        <Drawer
          open={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
          modal
          repositionInputs={false}
        >
          <DrawerContent className="h-full data-[vaul-drawer-direction=bottom]:max-h-svh -mx-px outline-none bg-card data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:rounded-none data-[vaul-drawer-direction=bottom]:border-t-0">
            <DrawerHeader className="pb-0">
              <DrawerTitle className="sr-only">Search Stations</DrawerTitle>
              <DrawerDescription className="sr-only">
                Search and select a train station from the list
              </DrawerDescription>
              <InputGroup className="h-10 bg-background">
                <InputGroupInput
                  placeholder="Search Station..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  name="search"
                  autoComplete="off"
                  aria-label="Search stations"
                />
                <InputGroupAddon>
                  {isSearchActive && !hasSearched ? (
                    <Spinner />
                  ) : (
                    <SearchIcon />
                  )}
                </InputGroupAddon>
                <AnimatePresence>
                  {isSearchActive && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2 }}
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </InputGroup>
            </DrawerHeader>

            <div className="flex-1 overflow-auto pt-2">
              {(!isSearchActive || hasSearched) && renderSearchContent()}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Desktop view - floating card with dropdown
  return (
    <div className="absolute z-50 top-4 left-4 flex flex-col gap-2 md:w-80 w-[calc(100svw-32px)] pointer-events-none font-sans">
      <InputGroup className="h-10 bg-card dark:bg-card pointer-events-auto">
        <InputGroupInput
          ref={inputRef}
          placeholder="Search Station..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => setFocusedIndex(-1)}
          name="search"
          autoComplete="off"
          role="combobox"
          aria-label="Search stations"
          aria-expanded={visibleStations.length > 0}
          aria-haspopup="listbox"
          aria-controls="station-listbox"
          aria-activedescendant={
            focusedIndex >= 0 && visibleStations[focusedIndex]
              ? `station-option-${visibleStations[focusedIndex].id}`
              : undefined
          }
        />
        <InputGroupAddon>
          {isSearchActive && !hasSearched ? <Spinner /> : <SearchIcon />}
        </InputGroupAddon>
        <AnimatePresence>
          {isSearchActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
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
            </motion.div>
          )}
        </AnimatePresence>
      </InputGroup>
      <AnimatePresence>
        {(!isSearchActive || hasSearched) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            style={{ height: cardHeight.height }}
            className="rounded-md pointer-events-auto overflow-hidden"
          >
            <div
              ref={cardHeight.contentRef}
              className="bg-card text-card-foreground rounded-md py-2 shadow-xs ring-1 ring-foreground/10 flex flex-col"
            >
              <div>{renderSearchContent(10)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
