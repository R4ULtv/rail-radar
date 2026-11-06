export const OG_PREFIX = "og/stations/";
export const OG_INVENTORY_KEY = "og/inventory.json";
export const OG_STATION_ID = /^[A-Z0-9_-]{1,64}$/;
export const OG_VERSION = /^[a-f0-9]{64}$/;

/** The only remote generation metadata: station ID -> current input fingerprint. */
export type StationOgInventory = Record<string, string>;

export function ogImageKey(stationId: string): string {
  if (!OG_STATION_ID.test(stationId)) throw new Error("Invalid OG station ID");
  return `${OG_PREFIX}${stationId}.webp`;
}

export function stationIdFromOgKey(key: string): string | null {
  if (!key.startsWith(OG_PREFIX) || !key.endsWith(".webp")) return null;
  const id = key.slice(OG_PREFIX.length, -5);
  return OG_STATION_ID.test(id) ? id : null;
}

export function parseStationOgInventory(value: unknown): StationOgInventory {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Invalid OG inventory");
  const entries = Object.entries(value);
  if (
    !entries.every(
      ([id, version]) =>
        OG_STATION_ID.test(id) && typeof version === "string" && OG_VERSION.test(version),
    )
  )
    throw new Error("Invalid OG inventory: expected station IDs mapped to SHA-256 input hashes");
  return Object.fromEntries(entries) as StationOgInventory;
}
