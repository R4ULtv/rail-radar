"use client";

import * as React from "react";
import useSWR from "swr";
import {
  HistoryIcon,
  ListIcon,
  SearchIcon,
  SearchXIcon,
  TrainFrontIcon,
  TrendingUpIcon,
  XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@repo/ui/components/card";
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

import { cn } from "@repo/ui/lib/utils";
import type { Station } from "@repo/data";

const POPULAR_STATIONS: Station[] = [
  { id: 1728, name: "Milano Centrale" },
  { id: 2416, name: "Roma Termini" },
  { id: 1325, name: "Firenze Santa Maria Novella" },
  { id: 1888, name: "Napoli Centrale" },
  { id: 3009, name: "Venezia S.Lucia" },
];

const StationList = React.memo(function StationList({
  stations,
  onSelect,
  focusedIndex = -1,
  startIndex = 0,
  onFocusIndex,
}: {
  stations: Station[];
  onSelect: (station: Station) => void;
  focusedIndex?: number;
  startIndex?: number;
  onFocusIndex?: (index: number) => void;
}) {
  if (stations.length === 0) return null;

  return (
    <ul role="listbox" className="flex flex-col">
      {stations.map((station, index) => {
        const globalIndex = startIndex + index;
        const isFocused = globalIndex === focusedIndex;

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
                "w-full px-4 py-2 text-left text-sm transition-colors duration-75 ease-out flex items-center gap-2",
                isFocused && "bg-muted",
              )}
            >
              <TrainFrontIcon className="size-4 text-muted-foreground" />
              {station.name}
            </button>
          </li>
        );
      })}
    </ul>
  );
});

export function Search() {
  const isMobile = useIsMobile();
  const { selectStation, recentStations } = useSelectedStation();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebounce(query.trim(), 300);
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);
  const [isFocused, setIsFocused] = React.useState(false);

  // Fetch search results with SWR
  const { data: searchResults = [], isLoading } = useSWR<Station[]>(
    debouncedQuery ? `/stations?q=${encodeURIComponent(debouncedQuery)}` : null,
    async (url: string) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
  );

  const isSearchActive = query.trim().length > 0;
  const hasSearched =
    isSearchActive && query.trim() === debouncedQuery && !isLoading;

  const noResults = isSearchActive && hasSearched && searchResults.length === 0;
  const showRecentAndPopular = !isSearchActive || noResults;

  const cardHeight = useAnimatedHeight();

  const handleSelectStation = React.useCallback(
    (station: Station) => {
      selectStation(station);
      inputRef.current?.blur();
    },
    [selectStation],
  );

  const visibleStations = React.useMemo(() => {
    if (isSearchActive && searchResults.length > 0) {
      return searchResults.slice(0, 10);
    }
    if (!isSearchActive || noResults) {
      return [...recentStations, ...POPULAR_STATIONS];
    }
    return [];
  }, [isSearchActive, searchResults, recentStations, noResults]);

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

  return (
    <div className="absolute z-50 top-4 left-4 flex flex-col gap-2 md:w-80 w-[calc(100vw-32px)] pointer-events-none font-sans">
      <InputGroup className="h-10 bg-card dark:bg-card pointer-events-auto">
        <InputGroupInput
          ref={inputRef}
          placeholder="Search Station..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            setFocusedIndex(-1);
          }}
          role="combobox"
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
                  onClick={() => {
                    setQuery("");
                    if (isMobile) {
                      inputRef.current?.blur();
                    }
                  }}
                >
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </motion.div>
          )}
        </AnimatePresence>
      </InputGroup>
      <AnimatePresence>
        {(!isMobile || isFocused) && (!isSearchActive || hasSearched) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            style={{ height: cardHeight.height }}
            className="rounded-md pointer-events-auto overflow-hidden"
          >
            <Card ref={cardHeight.contentRef} className="py-2 gap-0 rounded-md">
              <CardContent className="p-0">
                {/* Search Results */}
                {isSearchActive && searchResults.length > 0 && (
                  <>
                    <CardHeader className="px-4 py-2">
                      <CardDescription className="flex items-center gap-2">
                        <ListIcon className="size-3.5" />
                        Search Results
                      </CardDescription>
                    </CardHeader>
                    <StationList
                      stations={searchResults.slice(0, 10)}
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
                {/* Recent Stations */}
                {showRecentAndPopular && recentStations.length > 0 && (
                  <>
                    <CardHeader className="px-4 py-2">
                      <CardDescription className="flex items-center gap-2">
                        <HistoryIcon className="size-3.5" />
                        Recent Stations
                      </CardDescription>
                    </CardHeader>
                    <StationList
                      stations={recentStations}
                      onSelect={handleSelectStation}
                      focusedIndex={focusedIndex}
                      startIndex={0}
                      onFocusIndex={setFocusedIndex}
                    />
                  </>
                )}
                {/* Popular Stations */}
                {showRecentAndPopular && (
                  <>
                    <CardHeader className="px-4 py-2">
                      <CardDescription className="flex items-center gap-2">
                        <TrendingUpIcon className="size-3.5" />
                        Popular Stations
                      </CardDescription>
                    </CardHeader>
                    <StationList
                      stations={POPULAR_STATIONS}
                      onSelect={handleSelectStation}
                      focusedIndex={focusedIndex}
                      startIndex={recentStations.length}
                      onFocusIndex={setFocusedIndex}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
