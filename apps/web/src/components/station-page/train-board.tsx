"use client";

import { getCountry } from "@repo/data/countries";
import { useState, useSyncExternalStore } from "react";
import { useTrainData } from "@/hooks/use-train-data";
import { TrainColumn } from "./train-column";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";

export function TrainBoard({ stationId }: { stationId: string }) {
  const isMobile = useIsMobile();
  // useSyncExternalStore gives false on server, true on client — no effect cascade
  const mounted = useSyncExternalStore(
    (cb) => {
      cb();
      return () => {};
    },
    () => true,
    () => false,
  );
  const [type, setType] = useState<"arrivals" | "departures">("departures");
  const arrivalsSupported = getCountry(stationId) !== "lu";
  const activeType = arrivalsSupported ? type : "departures";

  // Desktop: fetch both; Mobile: only fetch active tab
  const departures = useTrainData(
    stationId,
    "departures",
    mounted && (isMobile === false || activeType === "departures"),
  );
  const arrivals = useTrainData(
    stationId,
    "arrivals",
    arrivalsSupported && mounted && (isMobile === false || activeType === "arrivals"),
  );

  // Prevent hydration mismatch - loading skeleton is handled by loading.tsx
  if (!mounted) {
    return null;
  }

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
          unavailableMessage={
            arrivalsSupported ? undefined : "Live arrivals for Luxembourg are coming soon."
          }
        />
      </div>
    );
  }

  // Mobile: Single column with toggle in header
  const currentData = activeType === "departures" ? departures : arrivals;

  return (
    <TrainColumn
      title={activeType === "departures" ? "Departures" : "Arrivals"}
      type={activeType}
      trainData={currentData.data}
      isLoading={currentData.isLoading}
      isValidating={currentData.isValidating}
      error={currentData.error}
      lastUpdated={currentData.lastUpdated}
      showTypeToggle
      onTypeChange={setType}
      arrivalsDisabled={!arrivalsSupported}
    />
  );
}
