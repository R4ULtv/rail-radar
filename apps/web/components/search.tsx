"use client";

import * as React from "react";
import {
  HistoryIcon,
  ListIcon,
  SearchIcon,
  SearchXIcon,
  TrainFrontIcon,
  TrendingUpIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnimatedHeight } from "@/hooks/use-animated-height";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSelectedStation } from "@/hooks/use-selected-station";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { Station } from "@repo/data";

const POPULAR_STATIONS: Station[] = [
  { id: 1728, name: "Milano Centrale" },
  { id: 2416, name: "Roma Termini" },
  { id: 1325, name: "Firenze Santa Maria Novella" },
  { id: 1888, name: "Napoli Centrale" },
  { id: 3009, name: "Venezia S.Lucia" },
];

function StationList({
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
}

export function Search() {
  const isMobile = useIsMobile();
  const { selectStation, recentStations } = useSelectedStation();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<Station[]>([]);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);
  const [isFocused, setIsFocused] = React.useState(false);

  const isSearchActive = query.trim().length > 0;

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

  // Reset focused index when list changes
  React.useEffect(() => {
    setFocusedIndex(-1);
  }, [query, searchResults.length]);

  React.useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setHasSearched(false);
    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/stations?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setHasSearched(true);
        }
      } catch (e) {
        if (e instanceof Error && e.name !== "AbortError") {
          console.error("Search failed:", e);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

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
          if (visibleStations.length === 0) return -1;
          if (prev < visibleStations.length - 1) return prev + 1;
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
        const station = visibleStations[focusedIndex];
        if (station) {
          handleSelectStation(station);
        }
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [focusedIndex, visibleStations, handleSelectStation]);

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
        <InputGroupAddon align="inline-end" className="hidden md:flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </InputGroupAddon>
      </InputGroup>
      <div
        className={cn(
          "rounded-md pointer-events-auto",
          ((isMobile && !isFocused) || (isSearchActive && !hasSearched)) &&
            "opacity-0 pointer-events-none!",
        )}
        style={cardHeight.style}
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
      </div>
    </div>
  );
}
