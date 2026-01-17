"use client";

import { useMemo, useState } from "react";
import {
  CopyIcon,
  ListIcon,
  MapPinOffIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import type { Station } from "@repo/data";
import { cn } from "@repo/ui/lib/utils";
import { Separator } from "@repo/ui/components/separator";
import type { ChangeType } from "../types/contribution";

type FilterType = "all" | "missing" | "duplicates";

interface StationSidebarProps {
  stations: Station[];
  selectedStationId: number | null;
  isAddingStation: boolean;
  changedStationIds?: Map<number, ChangeType>;
  onSelectStation: (id: number) => void;
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

  // Group stations by coordinates (for duplicates)
  const duplicateGroups = useMemo(() => {
    const coordGroups = new Map<string, Station[]>();
    for (const station of stations) {
      if (!station.geo) continue;
      const key = `${station.geo.lat},${station.geo.lng}`;
      const group = coordGroups.get(key);
      if (group) {
        group.push(station);
      } else {
        coordGroups.set(key, [station]);
      }
    }
    // Only keep groups with 2+ stations
    return Array.from(coordGroups.values()).filter((g) => g.length >= 2);
  }, [stations]);

  // Derive duplicate IDs from groups
  const duplicateIds = useMemo(() => {
    const ids = new Set<number>();
    for (const group of duplicateGroups) {
      for (const station of group) {
        ids.add(station.id);
      }
    }
    return ids;
  }, [duplicateGroups]);

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
    } else if (filter === "duplicates") {
      result = result.filter((s) => duplicateIds.has(s.id));
    }

    return result;
  }, [stations, search, filter, duplicateIds]);

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
            className="pl-9"
          />
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
              All
            </TabsTrigger>
            <TabsTrigger value="missing">
              <MapPinOffIcon className="size-3" />
              Missing
            </TabsTrigger>
            <TabsTrigger value="duplicates">
              <CopyIcon className="size-3" />
              Dupes
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="shrink-0 px-4 pb-2 text-xs font-medium text-muted-foreground">
        {filteredStations.length} station
        {filteredStations.length !== 1 ? "s" : ""}
      </div>

      <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]]:h-full">
        {filter === "duplicates" ? (
          <div className="flex flex-col px-2 pb-4">
            {duplicateGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="flex flex-col gap-0.5">
                <Separator className="my-1 mb-2" />
                <div className="px-2 text-xs font-medium text-muted-foreground">
                  {group[0]?.geo?.lat}, {group[0]?.geo?.lng}
                </div>
                {group.map((station) => renderStationItem(station))}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 px-2 pb-4">
            {filteredStations.map((station) => renderStationItem(station))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
