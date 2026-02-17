"use client";

import { useMemo, useState } from "react";
import {
  ListIcon,
  MapPinOffIcon,
  PlusIcon,
  SearchIcon,
  SquareMIcon,
  TramFrontIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import type { Station } from "@repo/data";
import { cn } from "@repo/ui/lib/utils";
import type { ChangeType } from "../types/contribution";

type FilterType = "all" | "missing" | "metro" | "light";

interface StationSidebarProps {
  stations: Station[];
  selectedStationId: string | null;
  isAddingStation: boolean;
  changedStationIds?: Map<string, ChangeType>;
  onSelectStation: (id: string) => void;
  onAddStationClick: () => void;
  contributionBanner?: React.ReactNode;
}

function getChangeIndicatorColor(changeType: ChangeType | undefined): string {
  switch (changeType) {
    case "created":
      return "bg-green-500";
    case "updated":
      return "bg-blue-500";
    case "deleted":
      return "bg-red-500";
    default:
      return "";
  }
}

export function StationSidebar({
  stations,
  selectedStationId,
  isAddingStation,
  changedStationIds,
  onSelectStation,
  onAddStationClick,
  contributionBanner,
}: StationSidebarProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredStations = useMemo(() => {
    let result = stations;

    // Apply search filter
    if (search.trim()) {
      const lowerSearch = search.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(lowerSearch));
    }

    // Apply type filter
    if (filter === "missing") {
      result = result.filter((s) => !s.geo);
    } else if (filter === "metro") {
      result = result.filter((s) => s.type === "metro");
    } else if (filter === "light") {
      result = result.filter((s) => s.type === "light");
    }

    return result;
  }, [stations, search, filter]);

  const renderStationItem = (station: Station) => {
    const changeType = changedStationIds?.get(station.id);
    const changeIndicatorColor = getChangeIndicatorColor(changeType);
    const hasGeo = !!station.geo;

    return (
      <button
        key={station.id}
        onClick={() => onSelectStation(station.id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
          selectedStationId === station.id && "bg-muted text-foreground",
        )}
      >
        <span className="relative flex items-center justify-center">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              hasGeo ? "bg-green-500" : "bg-muted-foreground/50",
            )}
          />
          {changeType && (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 size-1.5 rounded-full ring-2 ring-card",
                changeIndicatorColor,
              )}
            />
          )}
        </span>
        <span className="truncate">{station.name}</span>
        {station.type === "metro" && (
          <SquareMIcon className="size-3 shrink-0 text-muted-foreground" />
        )}
        {station.type === "light" && (
          <TramFrontIcon className="size-3 shrink-0 text-muted-foreground" />
        )}
      </button>
    );
  };

  return (
    <div className="flex h-full w-80 shrink-0 flex-col overflow-hidden border-r border-border bg-card">
      <div className="flex shrink-0 flex-col gap-3 p-4">
        {contributionBanner}
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search stations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn("pl-9", search && "pr-9")}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
        <Button
          variant={isAddingStation ? "secondary" : "outline"}
          onClick={onAddStationClick}
          className="w-full"
        >
          <PlusIcon className="size-4" />
          Add Station
        </Button>
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as FilterType)}
        >
          <TabsList className="w-full">
            <TabsTrigger value="all">
              <ListIcon className="size-3" />
              {filter === "all" && "All"}
            </TabsTrigger>
            <TabsTrigger value="missing">
              <MapPinOffIcon className="size-3" />
              {filter === "missing" && "Missing"}
            </TabsTrigger>
            <TabsTrigger value="metro">
              <SquareMIcon className="size-3" />
              {filter === "metro" && "Metro"}
            </TabsTrigger>
            <TabsTrigger value="light">
              <TramFrontIcon className="size-3" />
              {filter === "light" && "Light"}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="shrink-0 px-4 pb-2 text-xs font-medium text-muted-foreground">
        {filteredStations.length} station
        {filteredStations.length !== 1 ? "s" : ""}
      </div>

      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]]:h-full">
        <div className="flex flex-col gap-0.5 px-2 pb-4">
          {filteredStations.map((station) => renderStationItem(station))}
        </div>
      </ScrollArea>
    </div>
  );
}
