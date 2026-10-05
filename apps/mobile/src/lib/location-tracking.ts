import type { UserLocation } from "@/lib/user-location";

export type Movement = "unknown" | "moving" | "stationary";
export type LocationRequestMode = "fast" | "precise";

export type LocationFix = UserLocation & {
  timestamp: number;
  accuracy: number | null;
  speed: number | null;
  /** GPS course clockwise from true north, separate from the phone's compass orientation.
   * This is measured data, not a confirmed train direction; check speed, freshness and route.
   */
  travelHeading: number | null;
};

export const movingLocationIntervalMs = 5_000;
export const locationRequestMaxAgeMs = movingLocationIntervalMs;
export const stationaryLocationIntervalMs = 30_000;
export const searchLocationIntervalMs = 30_000;
export const locationFixMaxAgeMs = 30_000;
const movementEvidenceMaxGapMs = 60_000;
const movementAccuracyMeters = 100;
const minimumMovementMeters = 20;

export interface SearchLocationSnapshot {
  location: UserLocation | null;
  query: string;
  visible: boolean;
  updatedAt: number;
}

export function refreshSearchLocation(
  snapshot: SearchLocationSnapshot,
  location: UserLocation | null,
  query: string,
  visible: boolean,
  now = Date.now(),
): SearchLocationSnapshot {
  if (
    query === snapshot.query &&
    visible === snapshot.visible &&
    !(location === null && snapshot.location !== null) &&
    !(visible && location !== null && snapshot.location === null)
  ) {
    return snapshot;
  }
  return {
    location: visible || location === null ? location : snapshot.location,
    query,
    visible,
    updatedAt: now,
  };
}

export function searchLocationDelay(
  snapshot: SearchLocationSnapshot,
  distanceMeters: number,
  now = Date.now(),
) {
  if (!snapshot.visible || !snapshot.location || distanceMeters < 50) return null;
  return Math.max(0, searchLocationIntervalMs - (now - snapshot.updatedAt));
}

type Position = {
  timestamp: number;
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
  };
};

/** Cached, invalid and future fixes must not be mistaken for live positions. */
export function readLocationFix(position: Position, now = Date.now()): LocationFix | null {
  const { coords, timestamp } = position;
  if (
    !Number.isFinite(coords.latitude) ||
    Math.abs(coords.latitude) > 90 ||
    !Number.isFinite(coords.longitude) ||
    Math.abs(coords.longitude) > 180 ||
    !Number.isFinite(timestamp) ||
    timestamp > now + 5_000 ||
    now - timestamp > locationFixMaxAgeMs
  ) {
    return null;
  }

  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    timestamp,
    accuracy:
      coords.accuracy !== null && Number.isFinite(coords.accuracy) && coords.accuracy >= 0
        ? coords.accuracy
        : null,
    speed:
      coords.speed !== null && Number.isFinite(coords.speed) && coords.speed >= 0
        ? coords.speed
        : null,
    travelHeading:
      coords.heading !== null &&
      Number.isFinite(coords.heading) &&
      coords.heading >= 0 &&
      coords.heading <= 360
        ? coords.heading % 360
        : null,
  };
}

type LocationWatch = (
  onPosition: (position: Position) => void,
  onError: () => void,
) => Promise<{ remove: () => void }>;

/** Race recent cached and live positions; stop on the first usable fix or cancellation. */
export function acquireLocationFix(
  watch: LocationWatch,
  signal: AbortSignal,
  getLastKnownPosition?: () => Promise<Position | null>,
): Promise<LocationFix> {
  if (signal.aborted) return Promise.reject(new Error("Location request was cancelled."));
  return new Promise((resolve, reject) => {
    let subscription: { remove: () => void } | null = null;
    let settled = false;
    const timeout = setTimeout(
      () => finish(null, new Error("Your location is unavailable right now.")),
      20_000,
    );
    const abort = () => finish(null, new Error("Location request was cancelled."));

    function finish(fix: LocationFix | null, error?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      subscription?.remove();
      if (fix) resolve(fix);
      else reject(error);
    }

    function acceptPosition(position: Position) {
      if (settled) return;
      const now = Date.now();
      const fix = readLocationFix(position, now);
      // A position measured within one refresh interval is already current enough for the map.
      if (fix && now - fix.timestamp <= locationRequestMaxAgeMs) finish(fix);
    }

    signal.addEventListener("abort", abort, { once: true });
    watch(acceptPosition, () => finish(null, new Error("Your location is unavailable right now.")))
      .then((subscriptionToRemove) => {
        // A fix or cancellation can arrive before the native watch promise resolves.
        if (settled) subscriptionToRemove.remove();
        else subscription = subscriptionToRemove;
      })
      .catch(() => finish(null, new Error("Your location is unavailable right now.")));
    // A slow or unavailable cache must never delay the live watch.
    if (getLastKnownPosition) {
      void getLastKnownPosition()
        .then((position) => {
          if (position) acceptPosition(position);
        })
        .catch(() => {});
    }
  });
}

export interface MovementState {
  movement: Movement;
  anchor: LocationFix | null;
  lastTimestamp: number | null;
}

export function initialMovementState(): MovementState {
  return { movement: "unknown", anchor: null, lastTimestamp: null };
}

/**
 * Compare with a fixed anchor, so slow walking eventually exceeds the uncertainty radius.
 * Two nearby reliable fixes confirm stillness; displacement outside that range resumes fast checks.
 * Speed from a short-lived watch can be noisy, so it must not override matching positions.
 */
export function updateMovement(
  previous: MovementState,
  fix: LocationFix,
  distanceFromAnchorMeters: number,
): MovementState {
  if (previous.lastTimestamp !== null && fix.timestamp <= previous.lastTimestamp) return previous;

  if (fix.accuracy === null || fix.accuracy > movementAccuracyMeters) {
    return { ...initialMovementState(), lastTimestamp: fix.timestamp };
  }

  const state =
    previous.lastTimestamp !== null &&
    fix.timestamp - previous.lastTimestamp > movementEvidenceMaxGapMs
      ? initialMovementState()
      : previous;
  if (!state.anchor) {
    return { movement: "unknown", anchor: fix, lastTimestamp: fix.timestamp };
  }

  const uncertainty = Math.max(minimumMovementMeters, (state.anchor.accuracy ?? 0) + fix.accuracy);
  if (distanceFromAnchorMeters > uncertainty) {
    return { movement: "moving", anchor: fix, lastTimestamp: fix.timestamp };
  }

  return {
    movement: "stationary",
    anchor: state.anchor,
    lastTimestamp: fix.timestamp,
  };
}

interface LocationTrackerOptions {
  requestFix: (signal: AbortSignal, mode: LocationRequestMode) => Promise<LocationFix>;
  distanceMeters: (from: UserLocation, to: UserLocation) => number;
  onFix: (fix: LocationFix) => void;
  onError: (error: unknown) => void;
}

/** A foreground sampler. Locate shares fast requests and interrupts slow precision acquisition. */
export function createLocationTracker(options: LocationTrackerOptions) {
  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let controller: AbortController | null = null;
  let pending: Promise<LocationFix> | null = null;
  let pendingMode: LocationRequestMode | null = null;
  let latest: LocationFix | null = null;
  let movement = initialMovementState();

  function refresh(mode: LocationRequestMode = "fast"): Promise<LocationFix> {
    if (!running) return Promise.reject(new Error("Location tracking is paused."));
    if (pending) {
      if (mode === "precise" || pendingMode === "fast") return pending;
      // A Locate tap should not wait for a stationary high-accuracy request.
      controller?.abort();
      pending = null;
    }
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const requestController = new AbortController();
    controller = requestController;
    const startedAt = Date.now();
    let failed = false;
    const request = options
      .requestFix(requestController.signal, mode)
      .then((fix) => {
        if (requestController.signal.aborted) throw new Error("Location request was cancelled.");
        if (latest && fix.timestamp < latest.timestamp)
          throw new Error("Location fix is outdated.");
        if (latest?.timestamp === fix.timestamp) {
          options.onFix(fix);
          return fix;
        }
        const distance = movement.anchor ? options.distanceMeters(movement.anchor, fix) : 0;
        movement = updateMovement(movement, fix, distance);
        latest = fix;
        options.onFix(fix);
        return fix;
      })
      .catch((error: unknown) => {
        failed = true;
        if (!requestController.signal.aborted) {
          movement = initialMovementState();
          options.onError(error);
        }
        throw error;
      })
      .finally(() => {
        // An old request may settle after stopping and starting a new foreground session.
        if (pending !== request) return;
        pending = null;
        pendingMode = null;
        controller = null;
        if (!running) return;
        const interval =
          movement.movement === "stationary"
            ? stationaryLocationIntervalMs
            : movingLocationIntervalMs;
        const delay = failed ? interval : Math.max(1_000, interval - (Date.now() - startedAt));
        const nextMode = movement.movement === "stationary" ? "precise" : "fast";
        timer = setTimeout(() => void refresh(nextMode).catch(() => {}), delay);
      });
    pending = request;
    pendingMode = mode;
    return request;
  }

  return {
    start() {
      if (running) return;
      running = true;
      movement = initialMovementState();
      void refresh().catch(() => {});
    },
    stop() {
      running = false;
      controller?.abort();
      controller = null;
      pending = null;
      pendingMode = null;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      movement = initialMovementState();
    },
    refresh: () => refresh(),
    getLatestFix: () => latest,
  };
}
