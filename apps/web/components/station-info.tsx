"use client";

import type { Train } from "@repo/data";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CornerUpRightIcon,
  InfoIcon,
  MegaphoneIcon,
  ShareIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { SaveButton } from "@/components/save-button";
import { TrainRow, TrainRowSkeleton } from "@/components/train-row";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@repo/ui/components/drawer";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";

import { AnimatePresence, motion } from "motion/react";
import { useAnimatedHeight } from "@/hooks/use-animated-height";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import { useSelectedStation } from "@/hooks/use-selected-station";
import { useTrainData } from "@/hooks/use-train-data";

import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/button";

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
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!trainData || trainData.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No {type} scheduled
      </div>
    );
  }

  const trainList = trainData.map((train) => (
    <TrainRow
      key={`${train.trainNumber}-${train.scheduledTime}`}
      train={train}
      type={type}
    />
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
      className="mt-3 col-span-2"
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

const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
  style: "narrow",
});

function formatRelativeTime(secondsAgo: number): string {
  if (secondsAgo < 5) {
    return "Updated just now";
  }
  const minutesAgo = Math.floor(secondsAgo / 60);
  if (minutesAgo >= 1) {
    return `Updated ${relativeTimeFormatter.format(-minutesAgo, "minute")}`;
  }
  return `Updated ${relativeTimeFormatter.format(-secondsAgo, "second")}`;
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
    return formatRelativeTime(secondsAgo);
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
  const cardHeight = useAnimatedHeight();

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

  const handleDirections = () => {
    if (!selectedStation?.geo) return;

    const { lat, lng } = selectedStation.geo;
    const isApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);

    const url = isApple
      ? `https://maps.apple.com/?daddr=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&origin=Current+Location&destination=${lat},${lng}`;

    window.open(url, "_blank");
  };

  const {
    data: trainData,
    isLoading,
    isValidating,
    error,
    lastUpdated,
    info,
  } = useTrainData(selectedStation?.id ?? null, type, isOpen);

  // Desktop view
  if (!isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 top-4 right-4 font-sans"
          >
            <Button
              variant="outline"
              size="icon-sm"
              onClick={clearStation}
              className="bg-card hover:bg-muted dark:bg-card dark:hover:bg-muted absolute -left-11"
              aria-label="Close"
            >
              <XIcon className="size-4" />
            </Button>
            <motion.div style={{ height: cardHeight.height }}>
              <Card
                ref={cardHeight.contentRef}
                className="pt-4 pb-0 gap-4 rounded-md flex flex-col flex-1 w-96"
              >
                <CardHeader className="relative px-4">
                  <CardAction className="space-x-1">
                    {selectedStation && (
                      <SaveButton station={selectedStation} />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDirections}
                      aria-label="Directions"
                    >
                      <CornerUpRightIcon className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleShare}
                      aria-label="Share"
                    >
                      {copied ? (
                        <CheckIcon className="size-4" />
                      ) : (
                        <ShareIcon className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      nativeButton={false}
                      render={
                        <Link href={`/station/${selectedStation?.id}`}>
                          <InfoIcon className="size-4" />
                        </Link>
                      }
                      aria-label="View station details"
                    />
                  </CardAction>
                  <CardTitle className="truncate">
                    {selectedStation?.name}
                  </CardTitle>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Mobile view (Drawer)
  return (
    <Drawer
      snapPoints={snapPoints}
      snapPoint={snap}
      onSnapPointChange={setSnap}
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          clearStation();
        }
      }}
    >
      <DrawerContent
        className={cn(
          "h-full max-h-full! -mx-px outline-none bg-card",
          snap === 1 && "data-[swipe-direction=down]:rounded-t-none",
        )}
      >
        <DrawerHeader className="pb-3 relative group-data-[swipe-direction=down]/drawer-content:text-left">
          <DrawerTitle className="text-xl pr-39 truncate">
            {selectedStation?.name}
          </DrawerTitle>
          <DrawerDescription className="text-sm text-muted-foreground h-5">
            <UpdatedStatus
              isLoading={isLoading}
              isValidating={isValidating}
              lastUpdated={lastUpdated}
            />
          </DrawerDescription>
          {info != null && snap === 1 && (
            <div className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded mt-2">
              <MegaphoneIcon className="size-4 inline mr-1" />
              <span className="font-normal">{info}</span>
            </div>
          )}
          <StationTabs type={type} onTypeChange={setType} />
          <div className="absolute top-3.5 right-4 flex gap-1">
            {selectedStation && <SaveButton station={selectedStation} />}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDirections}
              aria-label="Directions"
            >
              <CornerUpRightIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              aria-label="Share"
            >
              {copied ? (
                <CheckIcon className="size-4" />
              ) : (
                <ShareIcon className="size-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              nativeButton={false}
              render={
                <Link href={`/station/${selectedStation?.id}`}>
                  <InfoIcon className="size-4" />
                </Link>
              }
              aria-label="View station details"
            />
          </div>
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
