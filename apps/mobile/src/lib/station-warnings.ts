import {
  getCountry,
  isNewRailData,
  newRailDataNotice,
  RAIL_DATA_WARNINGS,
} from "@repo/data/countries";

/** A note about the live data's quality in the station's country, if there is one. */
export function getStationWarning(stationId: string): string | null {
  const country = getCountry(stationId);
  if (!country) return null;
  return (
    RAIL_DATA_WARNINGS[country] ??
    (isNewRailData(country, Date.now()) ? newRailDataNotice(country) : null)
  );
}
