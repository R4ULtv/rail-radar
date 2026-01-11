"use client";

import type { Train } from "@repo/data";
import { ArrowDownLeftIcon, ArrowUpRightIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { TrainRow, TrainRowSkeleton } from "@/components/train-row";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useIsMobile } from "@/hooks/use-mobile";
import { useSelectedStation } from "@/hooks/use-selected-station";
import { useTrainData } from "@/hooks/use-train-data";

import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

function formatTime(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
}

// Shared component for train list content (loading, error, empty, list states)
function TrainListContent({
  trainData,
  isLoading,
  error,
  type,
  scrollable = false,
}: {
  trainData: Train[] | null;
  isLoading: boolean;
  error: string | null;
  type: "arrivals" | "departures";
  scrollable?: boolean;
}) {
  if (isLoading) {
    return (
      <div>
        {Array.from({ length: 6 }).map((_, i) => (
          <TrainRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-8 text-center text-sm text-red-500">{error}</div>
    );
  }

  if (!trainData || trainData.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No {type} scheduled
      </div>
    );
  }

  const trainList = trainData.map((train, index) => (
    <TrainRow key={`${train.trainNumber}-${index}`} train={train} type={type} />
  ));

  if (scrollable) {
    return (
      <ScrollArea className="max-h-[calc(100vh-164px)]">{trainList}</ScrollArea>
    );
  }

  return <div>{trainList}</div>;
}

// Shared tabs component
function StationTabs({
  type,
  onTypeChange,
}: {
  type: "arrivals" | "departures";
  onTypeChange: (type: "arrivals" | "departures") => void;
}) {
  return (
    <Tabs
      value={type}
      onValueChange={(value) =>
        onTypeChange(value as "arrivals" | "departures")
      }
      className="mt-3"
    >
      <TabsList className="w-full">
        <TabsTrigger value="departures">
          <ArrowUpRightIcon className="size-4" />
          Departures
        </TabsTrigger>
        <TabsTrigger value="arrivals">
          <ArrowDownLeftIcon className="size-4" />
          Arrivals
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

// Updated status text
function UpdatedStatus({
  isLoading,
  lastUpdated,
}: {
  isLoading: boolean;
  lastUpdated: Date | null;
}) {
  if (isLoading && !lastUpdated) {
    return "Updating...";
  }
  if (lastUpdated) {
    return `Updated ${formatTime(lastUpdated)}`;
  }
  return null;
}

const snapPoints = ["230px", "450px", 1];

export default function StationInfo() {
  const isMobile = useIsMobile();
  const { selectedStation, clearStation } = useSelectedStation();
  const [type, setType] = useState<"arrivals" | "departures">("departures");
  const [snap, setSnap] = useState<number | string | null>(
    snapPoints[0] as string,
  );

  // Derive open state from selectedStation
  const isOpen = !!selectedStation;

  const {
    data: trainData,
    isLoading,
    error,
    lastUpdated,
  } = useTrainData(selectedStation?.id ?? null, type, isOpen);

  // Desktop view
  if (!isMobile && isOpen) {
    return (
      <div className="absolute z-50 top-4 right-4 flex flex-col gap-2 md:w-96 w-[calc(100vw-32px)] font-sans">
        <Card className="pt-4 pb-0 gap-4 rounded-md flex flex-col">
          <CardHeader className="relative px-4">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={clearStation}
              className="absolute top-0 right-2"
              aria-label="Close"
            >
              <XIcon className="size-4" />
            </Button>
            <CardTitle className="pr-6">{selectedStation.name}</CardTitle>
            <CardDescription>
              <UpdatedStatus isLoading={isLoading} lastUpdated={lastUpdated} />
            </CardDescription>
            <StationTabs type={type} onTypeChange={setType} />
          </CardHeader>
          <CardContent className="flex-1 px-0">
            <TrainListContent
              trainData={trainData}
              isLoading={isLoading}
              error={error}
              type={type}
              scrollable
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mobile view (Drawer)
  return (
    <Drawer
      snapPoints={snapPoints}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      open={isOpen}
      onClose={clearStation}
      noBodyStyles
    >
      <DrawerContent className="h-full max-h-full! -mx-px outline-none bg-card">
        <DrawerHeader className="pb-3">
          <DrawerTitle className="text-xl">{selectedStation?.name}</DrawerTitle>
          <p className="text-sm text-muted-foreground h-5">
            <UpdatedStatus isLoading={isLoading} lastUpdated={lastUpdated} />
          </p>
          <StationTabs type={type} onTypeChange={setType} />
        </DrawerHeader>

        <div
          className={cn(
            "flex-1",
            snap === 1 ? "overflow-auto" : "overflow-hidden",
          )}
        >
          <TrainListContent
            trainData={trainData}
            isLoading={isLoading}
            error={error}
            type={type}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
