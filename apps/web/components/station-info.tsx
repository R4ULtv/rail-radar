"use client";

import type { Train } from "@repo/data";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CheckIcon,
  ShareIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

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
        {Array.from({ length: 8 }).map((_, i) => (
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
  isValidating,
  lastUpdated,
}: {
  isLoading: boolean;
  isValidating: boolean;
  lastUpdated: Date | null;
}) {
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [showUpdating, setShowUpdating] = useState(false);

  useEffect(() => {
    if (!lastUpdated) return;

    const calculateSecondsAgo = () => {
      return Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    };

    setSecondsAgo(calculateSecondsAgo());

    const interval = setInterval(() => {
      setSecondsAgo(calculateSecondsAgo());
    }, 1000);

    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Show "Updating..." only if validating takes more than 150ms
  useEffect(() => {
    if (isValidating) {
      const timer = setTimeout(() => setShowUpdating(true), 150);
      return () => clearTimeout(timer);
    } else {
      setShowUpdating(false);
    }
  }, [isValidating]);

  if ((isLoading && !lastUpdated) || showUpdating) {
    return "Updating...";
  }

  if (lastUpdated) {
    const minutesAgo = Math.floor(secondsAgo / 60);
    const timeText =
      secondsAgo < 5
        ? "Updated just now"
        : minutesAgo >= 1
          ? `Updated ${minutesAgo}m ago`
          : `Updated ${secondsAgo}s ago`;
    return `${timeText}`;
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
  const [copied, setCopied] = useState(false);

  // Derive open state from selectedStation
  const isOpen = !!selectedStation;

  const handleShare = async () => {
    if (!selectedStation) return;

    const shareUrl = window.location.href;
    const shareData = {
      title: selectedStation.name,
      text: `Check out ${selectedStation.name} on Rail Radar`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (_error) {
        console.log(_error);
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const {
    data: trainData,
    isLoading,
    isValidating,
    error,
    lastUpdated,
  } = useTrainData(selectedStation?.id ?? null, type, isOpen);

  // Desktop view
  if (!isMobile && isOpen) {
    return (
      <div className="absolute z-50 top-4 right-4 flex gap-2 font-sans">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={clearStation}
          className="shrink-0 self-start bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted"
          aria-label="Close"
        >
          <XIcon className="size-4" />
        </Button>
        <Card className="pt-4 pb-0 gap-4 rounded-md flex flex-col flex-1 w-96">
          <CardHeader className="relative px-4">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleShare}
              className="absolute top-0 right-4"
              aria-label="Share"
            >
              {copied ? (
                <CheckIcon className="size-4" />
              ) : (
                <ShareIcon className="size-4" />
              )}
            </Button>
            <CardTitle className="pr-6">{selectedStation.name}</CardTitle>
            <CardDescription>
              <UpdatedStatus
                isLoading={isLoading}
                isValidating={isValidating}
                lastUpdated={lastUpdated}
              />
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
        <DrawerHeader className="pb-3 relative group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
          <DrawerTitle className="text-xl">{selectedStation?.name}</DrawerTitle>
          <p className="text-sm text-muted-foreground h-5">
            <UpdatedStatus
              isLoading={isLoading}
              isValidating={isValidating}
              lastUpdated={lastUpdated}
            />
          </p>
          <StationTabs type={type} onTypeChange={setType} />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleShare}
            aria-label="Share"
            className="absolute top-3.5 right-4"
          >
            {copied ? (
              <CheckIcon className="size-4" />
            ) : (
              <ShareIcon className="size-4" />
            )}
          </Button>
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
