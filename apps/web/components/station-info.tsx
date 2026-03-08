"use client";

import type { Train } from "@repo/data";
import {
  ArrowDownLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  MegaphoneIcon,
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

import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";
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
    return <div className="px-4 py-8 text-center text-sm text-muted-foreground">{error}</div>;
  }

  if (!trainData || trainData.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">No {type} scheduled</div>
    );
  }

  const trainList = trainData.map((train) => (
    <TrainRow key={`${train.trainNumber}-${train.scheduledTime}`} train={train} type={type} />
  ));

  if (scrollable) {
    return <ScrollArea className="max-h-[calc(100vh-156px)]">{trainList}</ScrollArea>;
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
      onValueChange={(value) => onTypeChange(value as "arrivals" | "departures")}
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

import { UpdatedStatus } from "@/components/updated-status";

const snapPoints = ["230px", "450px", 1];

export default function StationInfo() {
  const isMobile = useIsMobile();
  const { selectedStation, clearStation } = useSelectedStation();
  const [type, setType] = useState<"arrivals" | "departures">("departures");
  const [snap, setSnap] = useState<number | string | null>(snapPoints[0] as string);
  const cardHeight = useAnimatedHeight();

  // Derive open state from selectedStation
  const isOpen = !!selectedStation;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        clearStation();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, clearStation]);

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
      <LazyMotion features={domAnimation}>
        <AnimatePresence>
          {isOpen && (
            <m.div
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
              <m.div style={{ height: cardHeight.height }}>
                <Card
                  ref={cardHeight.contentRef}
                  className="pt-4 pb-0 gap-2 rounded-md flex flex-col flex-1 w-96"
                >
                  <CardHeader className="relative px-4">
                    <CardAction className="space-x-1">
                      {selectedStation && <SaveButton station={selectedStation} />}
                      <Button
                        variant="ghost"
                        size="icon"
                        nativeButton={false}
                        render={
                          <Link href={`/station/${selectedStation?.id}`}>
                            <ArrowRightIcon className="size-4" />
                          </Link>
                        }
                        aria-label="View station details"
                      />
                    </CardAction>
                    <CardTitle>
                      <Link
                        href={`/station/${selectedStation?.id}`}
                        className="truncate hover:underline inline-flex items-center gap-1 group"
                      >
                        {selectedStation?.name}
                        <ArrowRightIcon className="size-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </Link>
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
              </m.div>
            </m.div>
          )}
        </AnimatePresence>
      </LazyMotion>
    );
  }

  // Mobile view (Drawer)
  return (
    <Drawer
      modal={false}
      disablePointerDismissal
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
          <DrawerTitle className="text-xl pr-20 truncate">
            <Link
              href={`/station/${selectedStation?.id}`}
              className="inline-flex items-center gap-1"
            >
              {selectedStation?.name}
            </Link>
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
              nativeButton={false}
              render={
                <Link href={`/station/${selectedStation?.id}`}>
                  <ArrowRightIcon className="size-4" />
                </Link>
              }
              aria-label="View station details"
            />
          </div>
        </DrawerHeader>

        <div className={cn("flex-1", snap === 1 ? "overflow-auto" : "overflow-hidden")}>
          <TrainListContent trainData={trainData} isLoading={isLoading} error={error} type={type} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
