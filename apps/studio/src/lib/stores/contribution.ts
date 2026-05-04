import type { Station } from "@repo/data";
import { derived, writable } from "svelte/store";
import type {
  ChangeType,
  ContributionSession,
  ContributionStats,
  StationChange,
} from "$lib/types/contribution";

const STORAGE_KEY = "rail-radar-studio-beta-contribution-session";

interface SerializedSession {
  startedAt: string;
  changes: Array<Omit<StationChange, "timestamp"> & { timestamp: string }>;
}

function serializeSession(session: ContributionSession): string {
  return JSON.stringify({
    startedAt: session.startedAt.toISOString(),
    changes: session.changes.map((change) => ({
      ...change,
      timestamp: change.timestamp.toISOString(),
    })),
  });
}

function deserializeSession(data: string): ContributionSession | null {
  try {
    const parsed = JSON.parse(data) as SerializedSession;
    return {
      startedAt: new Date(parsed.startedAt),
      changes: parsed.changes.map((change) => ({
        ...change,
        timestamp: new Date(change.timestamp),
      })),
    };
  } catch {
    return null;
  }
}

function calculateStats(session: ContributionSession): ContributionStats {
  let coordinatesUpdated = 0;
  let stationsRenamed = 0;
  let stationsCreated = 0;
  let stationsDeleted = 0;

  for (const change of session.changes) {
    if (change.type === "created") stationsCreated++;
    if (change.type === "deleted") stationsDeleted++;
    if (change.type === "updated") {
      if (change.details.coordinatesUpdated) coordinatesUpdated++;
      if (change.details.nameChanged) stationsRenamed++;
    }
  }

  return {
    changesCount: session.changes.length,
    coordinatesUpdated,
    stationsRenamed,
    stationsCreated,
    stationsDeleted,
  };
}

function createContributionStore() {
  const session = writable<ContributionSession | null>(null);

  function persist(value: ContributionSession | null) {
    if (typeof localStorage === "undefined") return;
    if (value) localStorage.setItem(STORAGE_KEY, serializeSession(value));
    else localStorage.removeItem(STORAGE_KEY);
  }

  function startSession() {
    const next = { startedAt: new Date(), changes: [] };
    session.set(next);
    persist(next);
  }

  return {
    session,
    changes: derived(session, ($session) => $session?.changes ?? []),
    stats: derived(session, ($session) => ($session ? calculateStats($session) : null)),
    changedStationIds: derived(session, ($session) => {
      const map = new Map<string, ChangeType>();
      for (const change of $session?.changes ?? []) map.set(change.id, change.type);
      return map;
    }),
    isSessionActive: derived(session, ($session) => ($session?.changes.length ?? 0) > 0),
    hydrate() {
      if (typeof localStorage === "undefined") return;
      const stored = localStorage.getItem(STORAGE_KEY);
      const restored = stored ? deserializeSession(stored) : null;
      if (restored) session.set(restored);
      else startSession();
    },
    startSession,
    clearSession: startSession,
    removeChange(stationId: string) {
      session.update((current) => {
        if (!current) return current;
        const next = {
          ...current,
          changes: current.changes.filter((change) => change.id !== stationId),
        };
        persist(next);
        return next;
      });
    },
    recordChange(type: ChangeType, station: Station, previousStation?: Station) {
      session.update((current) => {
        const active = current ?? { startedAt: new Date(), changes: [] };
        const change: StationChange = {
          id: station.id,
          type,
          stationName: station.name,
          timestamp: new Date(),
          details: {},
        };

        if (type === "created") {
          change.details.newName = station.name;
          change.details.newGeo = station.geo ?? null;
        } else if (type === "deleted") {
          change.details.previousName = station.name;
          change.details.previousGeo = station.geo ?? null;
        } else if (previousStation) {
          const nameChanged = previousStation.name !== station.name;
          const typeChanged = previousStation.type !== station.type;
          const importanceChanged = previousStation.importance !== station.importance;
          const coordinatesUpdated =
            previousStation.geo?.lat !== station.geo?.lat ||
            previousStation.geo?.lng !== station.geo?.lng;

          change.details = {
            previousName: nameChanged ? previousStation.name : undefined,
            newName: nameChanged ? station.name : undefined,
            previousGeo: previousStation.geo ?? null,
            newGeo: station.geo ?? null,
            coordinatesUpdated,
            nameChanged,
            typeChanged,
            previousType: typeChanged ? previousStation.type : undefined,
            newType: typeChanged ? station.type : undefined,
            importanceChanged,
            previousImportance: importanceChanged ? previousStation.importance : undefined,
            newImportance: importanceChanged ? station.importance : undefined,
          };
        }

        const next = {
          ...active,
          changes: [...active.changes.filter((item) => item.id !== station.id), change],
        };
        persist(next);
        return next;
      });
    },
  };
}

export const contributionStore = createContributionStore();
