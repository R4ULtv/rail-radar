import type { Station } from "@repo/data";
import type { CountryCode } from "@repo/data/countries";
import { getCountry } from "@repo/data/countries";
import { AlertTriangleIcon } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

/** Per-country rail data-quality warnings shown in the sidebar and on the station page. */
const STATION_WARNINGS: Partial<Record<CountryCode, string>> = {
  de: "After an extended outage, we switched the German data source. Coverage may be limited while we work to improve reliability.",
  pl: "Live data for stations in Poland may be unstable or incomplete right now. We are working to improve it.",
  ie: "Platform information is currently unavailable for stations in Ireland. We are working to improve it.",
  fr: "Platform and origin information may be missing for stations in France. We are working to improve it.",
  lu: "Live arrivals are not available yet for train stations in Luxembourg. We are working to add them.",
};

type WarningStation = Pick<Station, "id" | "type">;

function getStationWarning(station: WarningStation): string | undefined {
  if (station.type !== "rail") return undefined;
  const country = getCountry(station.id);
  return country ? STATION_WARNINGS[country] : undefined;
}

/** Whether a station shows a data-quality warning (its header is ~48px taller). */
export function hasStationWarning(station: WarningStation): boolean {
  return getStationWarning(station) !== undefined;
}

export function StationWarning({
  station,
  className,
}: {
  station: WarningStation;
  className?: string;
}) {
  const message = getStationWarning(station);

  if (!message) return null;

  return (
    <div
      className={cn(
        "flex max-w-fit items-start gap-2 rounded-2xl bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200",
        className,
      )}
    >
      <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
