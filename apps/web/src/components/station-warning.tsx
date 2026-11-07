import type { Station } from "@repo/data";
import {
  getCountry,
  isNewRailData,
  newRailDataNotice,
  RAIL_DATA_WARNINGS,
} from "@repo/data/countries";
import { AlertTriangleIcon, SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@repo/ui/lib/utils";

type WarningStation = Pick<Station, "id" | "type">;
type StationNotice = { kind: "issue" | "new"; message: string };

/** 0 until mounted, so prerendered station pages hydrate with the notice they were built with. */
function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => setNow(Date.now()), []);
  return now;
}

/** One notice per rail station: a known data issue takes precedence over a new data source. */
function getStationNotice(station: WarningStation | null, now: number): StationNotice | undefined {
  if (station?.type !== "rail") return undefined;
  const country = getCountry(station.id);
  if (!country) return undefined;
  const issue = RAIL_DATA_WARNINGS[country];
  if (issue) return { kind: "issue", message: issue };
  if (isNewRailData(country, now)) return { kind: "new", message: newRailDataNotice(country) };
  return undefined;
}

/** Whether a station shows a data notice (its header is ~48px taller). */
export function useHasStationWarning(station: WarningStation | null): boolean {
  return getStationNotice(station, useNow()) !== undefined;
}

export function StationWarning({
  station,
  className,
}: {
  station: WarningStation;
  className?: string;
}) {
  const notice = getStationNotice(station, useNow());

  if (!notice) return null;

  const Icon = notice.kind === "new" ? SparklesIcon : AlertTriangleIcon;
  return (
    <div
      className={cn(
        "flex max-w-fit items-start gap-2 rounded-2xl px-3 py-2 text-xs",
        notice.kind === "new"
          ? "bg-brand/10 text-brand dark:text-[color-mix(in_oklab,var(--color-brand)_45%,white)]"
          : "bg-amber-500/10 text-amber-900 dark:text-amber-200",
        className,
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <p>{notice.message}</p>
    </div>
  );
}
