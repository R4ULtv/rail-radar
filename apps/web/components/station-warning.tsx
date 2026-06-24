import type { CountryCode } from "@repo/data/countries";
import { getCountry } from "@repo/data/countries";
import { AlertTriangleIcon } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

/** Per-country data-quality warnings shown in the sidebar and on the station page. */
const STATION_WARNINGS: Partial<Record<CountryCode, string>> = {
  pl: "Live data for stations in Poland may be unstable or incomplete right now. We are working to improve it.",
  ie: "Platform information is currently unavailable for stations in Ireland. We are working to improve it.",
  fr: "Platform and origin information may be missing for stations in France. We are working to improve it.",
};

/** Whether a station shows a data-quality warning (its header is ~48px taller). */
export function hasStationWarning(stationId: string): boolean {
  const country = getCountry(stationId);
  return country ? country in STATION_WARNINGS : false;
}

export function StationWarning({
  stationId,
  className,
}: {
  stationId: string;
  className?: string;
}) {
  const country = getCountry(stationId);
  const message = country ? STATION_WARNINGS[country] : undefined;

  if (!message) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md max-w-fit bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200",
        className,
      )}
    >
      <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
