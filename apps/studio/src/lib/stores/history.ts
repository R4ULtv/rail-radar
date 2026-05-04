import type { Station } from "@repo/data";
import { derived, get, writable } from "svelte/store";

export type HistoryOp =
  | { kind: "create"; station: Station }
  | { kind: "update"; before: Station; after: Station }
  | { kind: "delete"; station: Station };

interface HistoryState {
  past: HistoryOp[];
  future: HistoryOp[];
  baselines: Record<string, Station | null>;
}

const STORAGE_KEY = "rail-radar-studio-beta-history";
const MAX_DEPTH = 100;

const initialState: HistoryState = { past: [], future: [], baselines: {} };

function persist(state: HistoryState) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

function describeOp(op: HistoryOp): string {
  if (op.kind === "create") return `create ${op.station.name}`;
  if (op.kind === "delete") return `delete ${op.station.name}`;
  return `edit ${op.after.name}`;
}

function baselineForOp(op: HistoryOp): Station | null {
  if (op.kind === "create") return null;
  if (op.kind === "update") return op.before;
  return op.station;
}

function createHistoryStore() {
  const store = writable<HistoryState>(initialState);

  return {
    subscribe: store.subscribe,
    past: derived(store, ($state) => $state.past),
    future: derived(store, ($state) => $state.future),
    canUndo: derived(store, ($state) => $state.past.length > 0),
    canRedo: derived(store, ($state) => $state.future.length > 0),
    nextUndoLabel: derived(store, ($state) => {
      const op = $state.past[$state.past.length - 1];
      return op ? describeOp(op) : null;
    }),
    nextRedoLabel: derived(store, ($state) => {
      const op = $state.future[$state.future.length - 1];
      return op ? describeOp(op) : null;
    }),
    hydrate() {
      if (typeof localStorage === "undefined") return;
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as Partial<HistoryState>;
        if (Array.isArray(parsed.past) && Array.isArray(parsed.future)) {
          store.set({
            past: parsed.past,
            future: parsed.future,
            baselines: parsed.baselines ?? {},
          });
        }
      } catch {
        // ignore
      }
    },
    getBaseline(stationId: string): { has: boolean; value: Station | null } {
      const map = get(store).baselines;
      const has = Object.hasOwn(map, stationId);
      return { has, value: has ? map[stationId]! : null };
    },
    push(op: HistoryOp) {
      store.update((state) => {
        const past = [...state.past, op].slice(-MAX_DEPTH);
        const baselines = { ...state.baselines };
        const id = op.kind === "update" ? op.after.id : op.station.id;
        if (!Object.hasOwn(baselines, id)) baselines[id] = baselineForOp(op);
        const next = { past, future: [], baselines };
        persist(next);
        return next;
      });
    },
    popPast(): HistoryOp | null {
      const state = get(store);
      const op = state.past[state.past.length - 1];
      if (!op) return null;
      const next = {
        past: state.past.slice(0, -1),
        future: [...state.future, op].slice(-MAX_DEPTH),
        baselines: state.baselines,
      };
      store.set(next);
      persist(next);
      return op;
    },
    popFuture(): HistoryOp | null {
      const state = get(store);
      const op = state.future[state.future.length - 1];
      if (!op) return null;
      const next = {
        past: [...state.past, op].slice(-MAX_DEPTH),
        future: state.future.slice(0, -1),
        baselines: state.baselines,
      };
      store.set(next);
      persist(next);
      return op;
    },
    clear() {
      store.set(initialState);
      persist(initialState);
    },
  };
}

export const historyStore = createHistoryStore();
