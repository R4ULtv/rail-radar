"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderIcon, SearchIcon, TrainFrontIcon } from "lucide-react";
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
import type { Station } from "@repo/data";

const POPULAR_STATIONS: Station[] = [
  { id: 1728, name: "Milano Centrale" },
  { id: 2416, name: "Roma Termini" },
  { id: 1325, name: "Firenze Santa Maria Novella" },
  { id: 1888, name: "Napoli Centrale" },
  { id: 3009, name: "Venezia S.Lucia" },
];

function StationList({ stations }: { stations: Station[] }) {
  if (stations.length === 0) return null;

  return (
    <ul className="flex flex-col">
      {stations.map((station) => (
        <li key={station.id}>
          <button className="w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors duration-75 ease-out flex items-center gap-2">
            <TrainFrontIcon className="size-4 text-muted-foreground" />
            {station.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Search() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Station[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setHasSearched(false);
    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://rail-radar.r-carini2003.workers.dev/stations?q=${encodeURIComponent(query)}`,
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
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (document.activeElement === inputRef.current) {
          inputRef.current?.blur();
        } else {
          inputRef.current?.focus();
        }
      }

      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isSearchActive = query.trim().length > 0;

  return (
    <div className="absolute top-4 left-4 flex flex-col gap-2 md:w-80 w-[calc(100vw-32px)]">
      <InputGroup className="h-10 bg-card dark:bg-card">
        <InputGroupInput
          ref={inputRef}
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <InputGroupAddon>
          {isSearching ? (
            <LoaderIcon className="animate-spin" />
          ) : (
            <SearchIcon />
          )}
        </InputGroupAddon>
        <InputGroupAddon align="inline-end" className="hidden md:flex">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </InputGroupAddon>
      </InputGroup>
      <Card className="py-2 gap-0 rounded-md">
        <CardHeader className="px-4 py-2">
          <CardDescription>
            {isSearchActive ? "Search Results" : "Popular Stations"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${
              isSearchActive && searchResults.length > 0
                ? "grid-rows-[1fr]"
                : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden min-h-0">
              <StationList stations={searchResults.slice(0, 10)} />
            </div>
          </div>
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-out ${
              isSearchActive && hasSearched && searchResults.length === 0
                ? "grid-rows-[1fr]"
                : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden min-h-0">
              <p className="px-4 py-2 text-sm text-muted-foreground">
                No stations found
              </p>
            </div>
          </div>
          <div
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${
              !isSearchActive ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden min-h-0">
              <StationList stations={POPULAR_STATIONS} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
