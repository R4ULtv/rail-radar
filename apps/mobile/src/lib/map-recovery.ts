interface MapRecovery {
  isOnline: boolean;
  hasLoaded: boolean;
  failed: boolean;
  key: number;
  retried: boolean;
}

type MapRecoveryEvent =
  | { type: "connection"; isOnline: boolean }
  | { type: "failed" | "loaded"; key: number };

export function initialMapRecovery(isOnline: boolean): MapRecovery {
  return { isOnline, hasLoaded: false, failed: false, key: 0, retried: false };
}

/** Retry an initial load once online, whether its error arrives before or after reconnecting. */
export function reduceMapRecovery(state: MapRecovery, event: MapRecoveryEvent): MapRecovery {
  if (event.type === "connection") {
    if (state.isOnline === event.isOnline) return state;
    if (!event.isOnline) return { ...state, isOnline: false, retried: false };
    return state.failed
      ? { ...state, isOnline: true, failed: false, key: state.key + 1, retried: true }
      : { ...state, isOnline: true };
  }

  // Native callbacks from a map that has already been replaced cannot fail the new attempt.
  if (event.key !== state.key) return state;
  if (event.type === "loaded") return { ...state, hasLoaded: true, failed: false };
  // Missing tiles after a successful initial load aren't a failed map.
  if (state.hasLoaded) return state;
  if (state.isOnline && !state.retried) {
    return { ...state, failed: false, key: state.key + 1, retried: true };
  }
  return { ...state, failed: true };
}
