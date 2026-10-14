"use client";

import type { Train } from "@repo/data";
import { getCountry } from "@repo/data/countries";
import {
  ArrowDownLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BugIcon,
  LightbulbIcon,
  MegaphoneIcon,
  XIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { hasStationWarning, StationWarning } from "@/components/station-warning";
import { SaveButton } from "@/components/save-button";
import { TrainRow, TrainRowSkeleton } from "@/components/train-row";
import { TrainBoardNotice } from "@/components/train-board-notice";
import { UpdatedStatus } from "@/components/updated-status";
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
import { stationPageLinkProps } from "@/lib/station-prerender";
import {
  BranchPicker,
  LineInfo,
  LinePageLink,
  LinePicker,
  StationLinesSummary,
} from "@/components/station-lines/line-pickers";
import { StationLinesMap } from "@/components/station-lines/station-lines-map";
import { StopStrip } from "@/components/station-lines/stop-strip";
import { useStationLineView } from "@/components/station-lines/use-station-line-view";

const REPORT_LINKS = (
  <div className="px-4 py-3 text-center ">
    <div className="flex items-center justify-center">
      <a
        href="https://github.com/R4ULtv/rail-radar/issues/new?template=bug_report.yml"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <BugIcon className="size-3" />
        Report a problem
      </a>
      <span className="text-muted-foreground/50 mx-1.5">·</span>
      <a
        href="https://github.com/R4ULtv/rail-radar/issues/new?template=feature_request.yml"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <LightbulbIcon className="size-3" />
        Feature request
      </a>
    </div>
    <p className="text-center text-xs text-muted-foreground mt-2">
      Rail Radar is free and open source. Reports from users help improve station and live-train
      data.
    </p>
  </div>
);

// Shared component for train list content (loading, error, empty, list states)
function TrainListContent({
  trainData,
  isLoading,
  isValidating,
  error,
  onRetry,
  type,
  scrollable = false,
  hasWarning = false,
}: {
  trainData: Train[] | null;
  isLoading: boolean;
  isValidating: boolean;
  error: string | null;
  onRetry: () => void;
  type: "arrivals" | "departures";
  scrollable?: boolean;
  hasWarning?: boolean;
}) {
  const hasSnapshot = trainData !== null;

  if (!hasSnapshot && error) {
    return <TrainBoardNotice hasSnapshot={false} isValidating={isValidating} onRetry={onRetry} />;
  }

  if (!hasSnapshot && isLoading) {
    return (
      <div>
        {Array.from({ length: 8 }).map((_, i) => (
          <TrainRowSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!hasSnapshot) {
    return null;
  }

  const content = (
    <>
      {error && <TrainBoardNotice hasSnapshot isValidating={isValidating} onRetry={onRetry} />}
      {trainData.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {error ? `No ${type} were listed in the last received update.` : `No ${type} scheduled`}
        </div>
      ) : (
        <>
          {trainData.map((train) => (
            <TrainRow
              key={`${train.trainNumber}-${train.scheduledTime}-${train.platform}`}
              train={train}
              type={type}
            />
          ))}
          {REPORT_LINKS}
        </>
      )}
    </>
  );

  if (scrollable) {
    return (
      <ScrollArea
        className={cn("max-h-[calc(100vh-156px)]", hasWarning && "max-h-[calc(100vh-208px)]")}
      >
        {content}
      </ScrollArea>
    );
  }

  return <div>{content}</div>;
}

// Shared tabs component
function StationTabs({
  type,
  onTypeChange,
  arrivalsDisabled = false,
}: {
  type: "arrivals" | "departures";
  onTypeChange: (type: "arrivals" | "departures") => void;
  arrivalsDisabled?: boolean;
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
        <TabsTrigger
          value="arrivals"
          disabled={arrivalsDisabled}
          aria-label={arrivalsDisabled ? "Arrivals (coming soon)" : "Arrivals"}
        >
          <ArrowDownLeftIcon className="size-4" />
          Arrivals
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

const snapPoints = ["230px", "450px", 1];

export default function StationInfo() {
  const isMobile = useIsMobile();
  const { selectedStation, clearStation } = useSelectedStation();
  const [type, setType] = useState<"arrivals" | "departures">("departures");
  const [snap, setSnap] = useState<number | string | null>(snapPoints[0] as string);
  const cardHeight = useAnimatedHeight();

  // Derive open state from selectedStation
  const isOpen = !!selectedStation;
  // Metro and light rail stations have no train board; they show the lines serving them.
  const isLines = selectedStation != null && selectedStation.type !== "rail";
  const lineView = useStationLineView(selectedStation);
  const arrivalsSupported = selectedStation ? getCountry(selectedStation.id) !== "lu" : true;
  const activeType = arrivalsSupported ? type : "departures";
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
    retry,
  } = useTrainData(selectedStation?.id ?? null, activeType, isOpen && !isLines);

  const linesMap = <StationLinesMap station={selectedStation} view={lineView} />;

  // Desktop view
  if (!isMobile) {
    return (
      <LazyMotion features={domAnimation}>
        {linesMap}
        <AnimatePresence>
          {isOpen && (
            <m.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
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
              <m.div style={{ height: cardHeight.height }} className="overflow-hidden rounded-4xl">
                <Card
                  ref={cardHeight.contentRef}
                  className={cn(
                    "flex w-96 flex-1 flex-col gap-2 pt-4 pb-0",
                    isLines && "max-h-[calc(100dvh-2rem)]",
                  )}
                >
                  <CardHeader className="relative shrink-0 px-4">
                    <CardAction className="flex gap-1">
                      {selectedStation && <SaveButton station={selectedStation} />}
                      {!isLines && (
                        <Button
                          variant="ghost"
                          size="icon"
                          nativeButton={false}
                          render={
                            <Link
                              to="/station/$id"
                              params={{ id: selectedStation?.id ?? "" }}
                              {...stationPageLinkProps(selectedStation)}
                            >
                              <ArrowRightIcon className="size-4" />
                            </Link>
                          }
                          aria-label="View station details"
                        />
                      )}
                    </CardAction>
                    <CardTitle>
                      {isLines ? (
                        <span className="truncate block max-w-68">{selectedStation?.name}</span>
                      ) : (
                        <Link
                          to="/station/$id"
                          params={{ id: selectedStation?.id ?? "" }}
                          {...stationPageLinkProps(selectedStation)}
                          className="truncate hover:underline block max-w-68"
                        >
                          {selectedStation?.name}
                        </Link>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {isLines ? (
                        <StationLinesSummary station={selectedStation} view={lineView} />
                      ) : (
                        <UpdatedStatus
                          isLoading={isLoading}
                          isValidating={isValidating && !error}
                          lastUpdated={lastUpdated}
                        />
                      )}
                    </CardDescription>
                    {selectedStation && (
                      <StationWarning station={selectedStation} className="col-span-2" />
                    )}
                    {isLines ? (
                      <div className="col-span-2 mt-3 flex flex-col gap-2.5">
                        <LinePicker view={lineView} />
                        <LineInfo view={lineView} />
                        <BranchPicker view={lineView} />
                      </div>
                    ) : (
                      <StationTabs
                        type={activeType}
                        onTypeChange={setType}
                        arrivalsDisabled={!arrivalsSupported}
                      />
                    )}
                  </CardHeader>
                  <CardContent className={cn("flex-1 px-0", isLines && "flex min-h-0 flex-col")}>
                    {isLines ? (
                      <ScrollArea className="flex min-h-0 flex-col">
                        <StopStrip view={lineView} />
                      </ScrollArea>
                    ) : (
                      <TrainListContent
                        trainData={trainData}
                        isLoading={isLoading}
                        isValidating={isValidating}
                        error={error}
                        onRetry={retry}
                        type={activeType}
                        scrollable
                        hasWarning={selectedStation != null && hasStationWarning(selectedStation)}
                      />
                    )}
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
    <>
      {linesMap}
      <Drawer
        modal={false}
        showSwipeHandle
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
            "h-full max-h-full! -mx-px pt-2 outline-none bg-card",
            snap === 1 &&
              "data-[swipe-direction=down]:my-0 data-[swipe-direction=down]:rounded-none",
          )}
        >
          <DrawerHeader className="relative pb-3 group-data-[swipe-axis=y]/drawer-popup:text-left">
            <DrawerTitle className={cn("text-xl truncate", isLines ? "pr-11" : "pr-20")}>
              {isLines ? (
                selectedStation?.name
              ) : (
                <Link
                  to="/station/$id"
                  params={{ id: selectedStation?.id ?? "" }}
                  {...stationPageLinkProps(selectedStation)}
                  className="inline-flex items-center gap-1"
                >
                  {selectedStation?.name}
                </Link>
              )}
            </DrawerTitle>
            <DrawerDescription className="text-sm text-muted-foreground h-5">
              {isLines ? (
                <StationLinesSummary station={selectedStation} view={lineView} />
              ) : (
                <UpdatedStatus
                  isLoading={isLoading}
                  isValidating={isValidating && !error}
                  lastUpdated={lastUpdated}
                />
              )}
            </DrawerDescription>
            {!isLines && info != null && snap === 1 && (
              <div className="mt-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                <MegaphoneIcon className="size-4 inline mr-1" />
                <span className="font-normal">{info}</span>
              </div>
            )}
            {selectedStation && <StationWarning station={selectedStation} className="col-span-2" />}
            {isLines ? (
              <div className="mt-3 flex flex-col gap-2.5">
                {/* With several lines the chips name them, so skip the termini row: the first snap point keeps the station in view. */}
                {lineView.lines.length > 1 ? (
                  <div className="flex items-center gap-2">
                    <LinePicker view={lineView} scroll className="min-w-0 flex-1" />
                    <LinePageLink view={lineView} />
                  </div>
                ) : (
                  <LineInfo view={lineView} />
                )}
                <BranchPicker view={lineView} />
              </div>
            ) : (
              <StationTabs
                type={activeType}
                onTypeChange={setType}
                arrivalsDisabled={!arrivalsSupported}
              />
            )}
            <div className="absolute top-3.5 right-4 flex gap-1">
              {selectedStation && <SaveButton station={selectedStation} />}
              {!isLines && (
                <Button
                  variant="ghost"
                  size="icon"
                  nativeButton={false}
                  render={
                    <Link
                      to="/station/$id"
                      params={{ id: selectedStation?.id ?? "" }}
                      {...stationPageLinkProps(selectedStation)}
                    >
                      <ArrowRightIcon className="size-4" />
                    </Link>
                  }
                  aria-label="View station details"
                />
              )}
            </div>
          </DrawerHeader>

          <div
            data-scroll
            className={cn("flex-1", snap === 1 ? "scroll-fade overflow-auto" : "overflow-hidden")}
          >
            {isLines ? (
              <StopStrip
                view={lineView}
                align="start"
                padEnd={snap !== 1}
                peek={typeof snap === "string" ? Number.parseInt(snap) : undefined}
              />
            ) : (
              <TrainListContent
                trainData={trainData}
                isLoading={isLoading}
                isValidating={isValidating}
                error={error}
                onRetry={retry}
                type={activeType}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
