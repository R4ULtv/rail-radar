"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { Station } from "@repo/data";
import type {
  StationChange,
  ContributionSession,
  ContributionStats,
  ChangeType,
} from "../types/contribution";

const STORAGE_KEY = "rail-radar-contribution-session";

interface ContributionContextValue {
  session: ContributionSession | null;
  changes: StationChange[];
  stats: ContributionStats | null;
  changedStationIds: Map<number, ChangeType>;
  startSession: (stations: Station[]) => void;
  recordChange: (
    type: ChangeType,
    station: Station,
    previousStation?: Station,
  ) => void;
  clearSession: () => void;
  isSessionActive: boolean;
}

const ContributionContext = createContext<ContributionContextValue | null>(
  null,
);

function calculateCoverage(stations: Station[]): number {
  if (stations.length === 0) return 0;
  const withCoords = stations.filter((s) => s.geo).length;
  return (withCoords / stations.length) * 100;
}

function calculateStats(
  session: ContributionSession,
  currentStations: Station[],
): ContributionStats {
  const changes = session.changes;

  let coordinatesAdded = 0;
  let coordinatesUpdated = 0;
  let stationsRenamed = 0;
  let stationsCreated = 0;
  let stationsDeleted = 0;

  for (const change of changes) {
    if (change.type === "created") {
      stationsCreated++;
      if (change.details.newGeo) {
        coordinatesAdded++;
      }
    } else if (change.type === "deleted") {
      stationsDeleted++;
    } else if (change.type === "updated") {
      if (change.details.coordinatesAdded) {
        coordinatesAdded++;
      }
      if (change.details.coordinatesUpdated) {
        coordinatesUpdated++;
      }
      if (change.details.nameChanged) {
        stationsRenamed++;
      }
    }
  }

  return {
    changesCount: changes.length,
    coordinatesAdded,
    coordinatesUpdated,
    stationsRenamed,
    stationsCreated,
    stationsDeleted,
    initialCoverage: session.initialCoverage,
    currentCoverage: calculateCoverage(currentStations),
  };
}

interface SerializedSession {
  startedAt: string;
  changes: Array<
    Omit<StationChange, "timestamp"> & {
      timestamp: string;
    }
  >;
  initialCoverage: number;
}

function serializeSession(session: ContributionSession): string {
  const serialized: SerializedSession = {
    startedAt: session.startedAt.toISOString(),
    changes: session.changes.map((c) => ({
      ...c,
      timestamp: c.timestamp.toISOString(),
    })),
    initialCoverage: session.initialCoverage,
  };
  return JSON.stringify(serialized);
}

function deserializeSession(data: string): ContributionSession | null {
  try {
    const parsed = JSON.parse(data) as SerializedSession;
    return {
      startedAt: new Date(parsed.startedAt),
      changes: parsed.changes.map((c) => ({
        ...c,
        timestamp: new Date(c.timestamp),
      })),
      initialCoverage: parsed.initialCoverage,
    };
  } catch {
    return null;
  }
}

export function ContributionProvider({
  children,
  stations,
}: {
  children: React.ReactNode;
  stations: Station[];
}) {
  const [session, setSession] = useState<ContributionSession | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const restored = deserializeSession(stored);
      if (restored) {
        setSession(restored);
      }
    }
    setIsInitialized(true);
  }, []);

  // Save session to localStorage when it changes
  useEffect(() => {
    if (!isInitialized) return;

    if (session) {
      localStorage.setItem(STORAGE_KEY, serializeSession(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session, isInitialized]);

  // Auto-start session when stations are loaded and no session exists
  useEffect(() => {
    if (isInitialized && !session && stations.length > 0) {
      setSession({
        startedAt: new Date(),
        changes: [],
        initialCoverage: calculateCoverage(stations),
      });
    }
  }, [isInitialized, session, stations]);

  const startSession = useCallback((currentStations: Station[]) => {
    setSession({
      startedAt: new Date(),
      changes: [],
      initialCoverage: calculateCoverage(currentStations),
    });
  }, []);

  const recordChange = useCallback(
    (type: ChangeType, station: Station, previousStation?: Station) => {
      setSession((prev) => {
        if (!prev) return prev;

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
        } else if (type === "updated" && previousStation) {
          // Check what changed
          const nameChanged = previousStation.name !== station.name;
          const hadGeo = !!previousStation.geo;
          const hasGeo = !!station.geo;
          const coordinatesAdded = !hadGeo && hasGeo;
          const coordinatesUpdated =
            hadGeo &&
            hasGeo &&
            (previousStation.geo!.lat !== station.geo!.lat ||
              previousStation.geo!.lng !== station.geo!.lng);

          change.stationName = station.name;
          change.details = {
            previousName: nameChanged ? previousStation.name : undefined,
            newName: nameChanged ? station.name : undefined,
            previousGeo: previousStation.geo ?? null,
            newGeo: station.geo ?? null,
            coordinatesAdded,
            coordinatesUpdated,
            nameChanged,
          };
        }

        // Remove any existing change for this station and add the new one
        const filteredChanges = prev.changes.filter((c) => c.id !== station.id);

        return {
          ...prev,
          changes: [...filteredChanges, change],
        };
      });
    },
    [],
  );

  const clearSession = useCallback(() => {
    setSession({
      startedAt: new Date(),
      changes: [],
      initialCoverage: calculateCoverage(stations),
    });
  }, [stations]);

  const stats = useMemo(() => {
    if (!session) return null;
    return calculateStats(session, stations);
  }, [session, stations]);

  const changedStationIds = useMemo(() => {
    const map = new Map<number, ChangeType>();
    if (!session) return map;
    for (const change of session.changes) {
      map.set(change.id, change.type);
    }
    return map;
  }, [session]);

  const value: ContributionContextValue = {
    session,
    changes: session?.changes ?? [],
    stats,
    changedStationIds,
    startSession,
    recordChange,
    clearSession,
    isSessionActive: !!session && session.changes.length > 0,
  };

  return (
    <ContributionContext.Provider value={value}>
      {children}
    </ContributionContext.Provider>
  );
}

export function useContribution() {
  const context = useContext(ContributionContext);
  if (!context) {
    throw new Error(
      "useContribution must be used within a ContributionProvider",
    );
  }
  return context;
}
