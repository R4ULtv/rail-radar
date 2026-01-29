"use client";

import { useState } from "react";
import { useTrainData } from "@/hooks/use-train-data";
import { TrainColumn } from "./train-column";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@repo/ui/components/tabs";
import { ArrowDownLeftIcon, ArrowUpRightIcon } from "lucide-react";

interface TrainBoardProps {
  stationId: number;
}

export function TrainBoard({ stationId }: TrainBoardProps) {
  const isMobile = useIsMobile();
  const [type, setType] = useState<"arrivals" | "departures">("departures");

  const departures = useTrainData(stationId, "departures", true);
  const arrivals = useTrainData(stationId, "arrivals", true);

  // Desktop: Two columns side by side
  if (!isMobile) {
    return (
      <div className="grid grid-cols-2 gap-6">
        <TrainColumn
          title="Departures"
          type="departures"
          trainData={departures.data}
          isLoading={departures.isLoading}
          isValidating={departures.isValidating}
          error={departures.error}
          lastUpdated={departures.lastUpdated}
        />
        <TrainColumn
          title="Arrivals"
          type="arrivals"
          trainData={arrivals.data}
          isLoading={arrivals.isLoading}
          isValidating={arrivals.isValidating}
          error={arrivals.error}
          lastUpdated={arrivals.lastUpdated}
        />
      </div>
    );
  }

  // Mobile: Tabbed view
  return (
    <Tabs
      value={type}
      onValueChange={(value) => setType(value as "arrivals" | "departures")}
    >
      <div className="px-4">
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
      </div>
      <TabsContent value="departures">
        <TrainColumn
          title="Departures"
          type="departures"
          trainData={departures.data}
          isLoading={departures.isLoading}
          isValidating={departures.isValidating}
          error={departures.error}
          lastUpdated={departures.lastUpdated}
        />
      </TabsContent>
      <TabsContent value="arrivals">
        <TrainColumn
          title="Arrivals"
          type="arrivals"
          trainData={arrivals.data}
          isLoading={arrivals.isLoading}
          isValidating={arrivals.isValidating}
          error={arrivals.error}
          lastUpdated={arrivals.lastUpdated}
        />
      </TabsContent>
    </Tabs>
  );
}
