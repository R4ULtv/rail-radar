"use client";

import type { Train } from "@repo/data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";
import { TrainRow, TrainRowSkeleton } from "@/components/train-row";
import { ArrowDownLeftIcon, ArrowUpRightIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface TrainColumnProps {
  title: string;
  type: "arrivals" | "departures";
  trainData: Train[] | null;
  isLoading: boolean;
  isValidating: boolean;
  error: string | null;
  lastUpdated: Date | null;
  showTypeToggle?: boolean;
  onTypeChange?: (type: "arrivals" | "departures") => void;
}

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
    return timeText;
  }

  return null;
}

export function TrainColumn({
  title,
  type,
  trainData,
  isLoading,
  isValidating,
  error,
  lastUpdated,
  showTypeToggle,
  onTypeChange,
}: TrainColumnProps) {
  const Icon = type === "departures" ? ArrowUpRightIcon : ArrowDownLeftIcon;

  return (
    <Card className="flex flex-col h-full pt-4 pb-0 md:py-4 gap-4 rounded-none ring-0 shadow-none md:rounded-xl md:ring-1 md:shadow-xs">
      <CardHeader className="px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="size-4" />
            {title}
          </CardTitle>
          {showTypeToggle && onTypeChange && (
            <ToggleGroup
              value={[type]}
              onValueChange={(value) => {
                const selected = value[0];
                if (selected)
                  onTypeChange(selected as "arrivals" | "departures");
              }}
              size="sm"
              variant="outline"
            >
              <ToggleGroupItem
                value="departures"
                className="gap-1 px-2 py-1 h-7 text-xs"
              >
                <ArrowUpRightIcon className="size-3.5" />
                <span className={type === "departures" ? "" : "hidden"}>
                  Departures
                </span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="arrivals"
                className="gap-1 px-2 py-1 h-7 text-xs"
              >
                <ArrowDownLeftIcon className="size-3.5" />
                <span className={type === "arrivals" ? "" : "hidden"}>
                  Arrivals
                </span>
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
        <CardDescription>
          <UpdatedStatus
            isLoading={isLoading}
            isValidating={isValidating}
            lastUpdated={lastUpdated}
          />
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 px-0 overflow-auto">
        {isLoading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <TrainRowSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {error}
          </div>
        ) : !trainData || trainData.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No {type} scheduled
          </div>
        ) : (
          <div>
            {trainData.map((train, index) => (
              <TrainRow
                key={`${train.trainNumber}-${index}`}
                train={train}
                type={type}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
