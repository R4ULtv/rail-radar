import type { Train } from "@repo/data/types";

export type BoardType = "departures" | "arrivals";

export interface BoardResponse {
  timestamp: string;
  info: string | null;
  trains: Train[];
}

interface CachedBoard {
  data: BoardResponse;
  /** Monotonic deadline, seeded from the API's Date/Age rather than the phone's wall clock. */
  refreshAt: number;
}

// Enough for both tabs of twenty stations, without growing throughout a long map session.
const maxCachedBoards = 40;

export function createStationBoardCache(limit = maxCachedBoards) {
  const boards = new Map<string, CachedBoard>();

  return {
    // Rendering may peek without changing the eviction order.
    peek: (key: string) => boards.get(key),
    get: (key: string) => {
      const cached = boards.get(key);
      if (cached) {
        boards.delete(key);
        boards.set(key, cached);
      }
      return cached;
    },
    set: (key: string, data: BoardResponse, refreshDelay: number) => {
      boards.delete(key);
      boards.set(key, { data, refreshAt: performance.now() + refreshDelay });
      if (boards.size > limit) boards.delete(boards.keys().next().value!);
    },
    // Keep the rows on resume, but refetch even when the monotonic clock paused during sleep.
    expire: () => {
      for (const cached of boards.values()) cached.refreshAt = 0;
    },
  };
}

/** Session-wide: station sheets remount, but their recently received boards stay available. */
export const stationBoardCache = createStationBoardCache();
