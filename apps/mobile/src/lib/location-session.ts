type AppState = "active" | "inactive" | "background" | "unknown" | "extension" | null;

interface LocationSessionOptions {
  initialState: AppState;
  checkAccess: (askPermission: boolean) => Promise<void>;
  start: () => void;
  stop: () => void;
}

const cancelled = () => new Error("Location request was cancelled.");

/** Share permission checks and wait through the brief inactive state of an iOS dialog. */
export function createLocationSession(options: LocationSessionOptions) {
  let state = options.initialState;
  let disposed = false;
  let generation = 0;
  let activation: { promise: Promise<void>; askPermission: boolean } | null = null;
  const waiters = new Set<{ resolve: () => void; reject: (error: Error) => void }>();

  function waitForForeground() {
    if (disposed || state === "background") return Promise.reject(cancelled());
    // Native AppState can still be unknown during startup; don't skip the first request.
    if (state !== "inactive") return Promise.resolve();
    return new Promise<void>((resolve, reject) => waiters.add({ resolve, reject }));
  }

  function activate(askPermission: boolean): Promise<void> {
    const currentGeneration = generation;
    if (activation) {
      const pending = activation;
      // A read-only resume check must not swallow an explicit request for permission.
      return askPermission && !pending.askPermission
        ? pending.promise
            .catch(() => {})
            .then(() => {
              if (disposed || generation !== currentGeneration) throw cancelled();
              return activate(true);
            })
        : pending.promise;
    }
    const pending = {
      askPermission,
      promise: waitForForeground()
        .then(() => {
          if (disposed || generation !== currentGeneration) throw cancelled();
          return options.checkAccess(askPermission);
        })
        .then(() => {
          if (disposed || generation !== currentGeneration) throw cancelled();
          return waitForForeground();
        })
        .then(() => {
          if (disposed || generation !== currentGeneration) throw cancelled();
          options.start();
        })
        .catch((error: unknown) => {
          if (disposed || generation !== currentGeneration) throw cancelled();
          throw error;
        })
        .finally(() => {
          if (activation === pending) activation = null;
        }),
    };
    activation = pending;
    return pending.promise;
  }

  function cancelPending() {
    generation++;
    activation = null;
    for (const waiter of waiters) waiter.reject(cancelled());
    waiters.clear();
    options.stop();
  }

  return {
    activate,
    setAppState(nextState: AppState) {
      state = nextState;
      if (state === "background") cancelPending();
      else if (state === "inactive") options.stop();
      else {
        for (const waiter of waiters) waiter.resolve();
        waiters.clear();
      }
    },
    dispose() {
      disposed = true;
      cancelPending();
    },
  };
}
