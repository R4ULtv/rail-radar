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

  // The prerendered page can't know the viewport, so it shows the loading board until hydration
  // swaps in the same layout, without a jump.
  if (!mounted) {
    return <TrainBoardLoading arrivalsSupported={arrivalsSupported} />;
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
          onRetry={departures.retry}
        />
        <TrainColumn
          title="Arrivals"
          type="arrivals"
          trainData={arrivals.data}
          isLoading={arrivals.isLoading}
          isValidating={arrivals.isValidating}
          error={arrivals.error}
          lastUpdated={arrivals.lastUpdated}
          onRetry={arrivals.retry}
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
      onRetry={currentData.retry}
      showTypeToggle
      onTypeChange={setType}
      arrivalsDisabled={!arrivalsSupported}
    />
  );
}

const loadingColumn = {
  trainData: null,
  isLoading: true,
  isValidating: false,
  error: null,
  lastUpdated: null,
  onRetry: () => {},
};

/** The board as it first loads, for both viewports; CSS shows the one that fits. */
export function TrainBoardLoading({ arrivalsSupported = true }: { arrivalsSupported?: boolean }) {
  return (
    <>
      <div className="md:hidden">
        <TrainColumn
          title="Departures"
          type="departures"
          {...loadingColumn}
          showTypeToggle
          onTypeChange={loadingColumn.onRetry}
          arrivalsDisabled={!arrivalsSupported}
        />
      </div>
      <div className="hidden grid-cols-2 gap-6 md:grid">
        <TrainColumn title="Departures" type="departures" {...loadingColumn} />
        <TrainColumn
          title="Arrivals"
          type="arrivals"
          {...loadingColumn}
          unavailableMessage={
            arrivalsSupported ? undefined : "Live arrivals for Luxembourg are coming soon."
          }
        />
      </div>
    </>
  );
}
