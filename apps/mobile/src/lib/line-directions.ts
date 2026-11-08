// Which way along a line someone is going, from its routes' stop IDs alone, so it can be checked
// without React or the bundled data. The line sheet names each way after where it ends: "Going
// towards Gessate".

/** A route, and whether it's taken against the order its stops are listed in. */
export interface LineDirection {
  route: number;
  reversed: boolean;
}

export function isSameDirection(a: LineDirection, b: LineDirection): boolean {
  return a.route === b.route && a.reversed === b.reversed;
}

function isLoop(stations: readonly string[]): boolean {
  return stations.length > 2 && stations[0] === stations.at(-1);
}

/**
 * The routes listed the same way round as the first one. The data lists some branches from either
 * end (Battersea → Edgware next to Edgware → Morden), and the sheet needs them to agree so a way
 * along the line stays on the same side of its diagram whichever route it takes. A route is turned
 * round when the stops it shares with an earlier route come in the opposite order.
 */
export function orientRoutes(routes: readonly (readonly string[])[]): string[][] {
  const flipped: boolean[] = [];
  routes.forEach((stations, index) => {
    flipped[index] = false;
    for (let other = 0; other < index; other++) {
      const positions = new Map<string, number>();
      routes[other]!.forEach((id, position) => {
        if (!positions.has(id)) positions.set(id, position);
      });
      const shared = stations.flatMap((id) => {
        const position = positions.get(id);
        return position === undefined ? [] : [position];
      });
      if (shared.length < 2) continue;
      flipped[index] = shared[0]! > shared.at(-1)! !== flipped[other];
      break;
    }
  });
  return routes.map((stations, index) =>
    flipped[index] ? [...stations].reverse() : [...stations],
  );
}

/** A route's stops in the order they're travelled. */
export function getTravelStops(
  routes: readonly (readonly string[])[],
  direction: LineDirection,
): readonly string[] {
  const stations = routes[direction.route] ?? routes[0] ?? [];
  return direction.reversed ? [...stations].reverse() : stations;
}

/**
 * Where to go from a stop at first: along the longest route through it, towards the end with more
 * stops ahead. From Centrale FS, M2 goes towards Gessate. Opened from elsewhere, the first route
 * the way it's listed.
 */
export function getInitialDirection(
  routes: readonly (readonly string[])[],
  focusId: string | null,
): LineDirection {
  let best: LineDirection = { route: 0, reversed: false };
  if (!focusId) return best;
  let bestLength = -1;
  routes.forEach((stations, route) => {
    const at = stations.indexOf(focusId);
    if (at < 0 || stations.length <= bestLength) return;
    bestLength = stations.length;
    best = { route, reversed: !isLoop(stations) && at > stations.length - 1 - at };
  });
  return best;
}

/**
 * The way to go to reach a stop picked on the diagram: the stop's route, towards the stop from the
 * one the line was opened from. The stop that one was opened from keeps the current way when it
 * can, and otherwise heads where there are more stops.
 */
export function getDirectionTo(
  routes: readonly (readonly string[])[],
  route: number,
  stopIndex: number,
  focusId: string | null,
  current: LineDirection,
): LineDirection {
  const stations = routes[route] ?? [];
  const focus = focusId ? stations.indexOf(focusId) : -1;
  if (focus < 0 || isLoop(stations)) return { route, reversed: current.reversed };
  if (stopIndex !== focus) return { route, reversed: stopIndex < focus };
  const ahead = current.reversed ? focus : stations.length - 1 - focus;
  if (ahead > 0) return { route, reversed: current.reversed };
  return { route, reversed: !current.reversed };
}

export interface DirectionOption {
  key: string;
  /** The route this way is shown along: the longest one, when several go the same way. */
  direction: LineDirection;
  /** Every route that goes this way, so any of them marks it as chosen. */
  directions: LineDirection[];
  /** Where it ends, or where it starts for a loop. */
  destinationId: string;
  /** Where it starts, for a line opened from elsewhere. */
  originId: string;
  /** The next stop after the one the line was opened from. */
  nextId: string | null;
  /** The stop it takes that another way to the same end doesn't, "Bank". */
  via: string | null;
  /** The stops ahead, or all of them for a line opened from elsewhere. */
  stopCount: number;
  /** The side of the diagram it heads to; for a loop, left is anticlockwise. */
  side: "left" | "right";
  isLoop: boolean;
}

interface Candidate extends Omit<DirectionOption, "via"> {
  /** The stops it goes through, to tell it apart from other ways to the same end. */
  path: readonly string[];
  /** Groups the ways to the same end. */
  endKey: string;
}

function describe(
  stations: readonly string[],
  direction: LineDirection,
  focusId: string | null,
): Candidate | null {
  if (stations.length < 2) return null;
  const loop = isLoop(stations);
  const stops = direction.reversed ? [...stations].reverse() : stations;
  const side = direction.reversed ? "left" : "right";
  const at = focusId ? stops.indexOf(focusId) : -1;

  if (focusId && at < 0) return null;
  if (at < 0) {
    const key = stops.join(">");
    return {
      key,
      direction,
      directions: [direction],
      destinationId: stops.at(-1)!,
      originId: stops[0]!,
      nextId: null,
      stopCount: new Set(stops).size,
      side,
      isLoop: loop,
      path: stops,
      endKey: `${stops[0]}>${stops.at(-1)}`,
    };
  }

  // Round a loop from the stop it was opened from, back to the one before it.
  const ring = loop ? stops.slice(0, -1) : stops;
  const ahead = loop ? [...ring.slice(at + 1), ...ring.slice(0, at)] : stops.slice(at + 1);
  if (ahead.length === 0) return null;
  return {
    key: `${direction.reversed ? "<" : ">"}${ahead.join(">")}`,
    direction,
    directions: [direction],
    destinationId: loop ? stops[0]! : stops.at(-1)!,
    originId: stops[0]!,
    nextId: ahead[0]!,
    stopCount: ahead.length,
    side,
    isLoop: loop,
    path: ahead,
    endKey: loop ? `loop:${side}` : stops.at(-1)!,
  };
}

/**
 * The ways someone can go along the line, each named after where it ends. From a stop on the
 * line, those are the ways on from it, and routes that go on to the same end the same way are one.
 * Two ways to the same end are told apart by a stop only one of them takes. The current way is
 * always among them, even one that doesn't go through the stop. Those heading left come first.
 */
export function getDirectionOptions(
  routes: readonly (readonly string[])[],
  focusId: string | null,
  current: LineDirection,
  viaOf: (ids: readonly string[]) => string | null,
): DirectionOption[] {
  const candidates = new Map<string, Candidate>();
  const add = (candidate: Candidate | null) => {
    if (!candidate) return;
    const existing = candidates.get(candidate.key);
    if (!existing) {
      candidates.set(candidate.key, candidate);
      return;
    }
    existing.directions.push(candidate.direction);
    const length = (direction: LineDirection) => routes[direction.route]?.length ?? 0;
    if (length(candidate.direction) > length(existing.direction)) {
      existing.direction = candidate.direction;
      existing.originId = candidate.originId;
    }
  };

  routes.forEach((stations, route) => {
    for (const reversed of [false, true]) add(describe(stations, { route, reversed }, focusId));
  });
  const all = [...candidates.values()];
  if (!all.some(({ directions }) => directions.some((one) => isSameDirection(one, current)))) {
    const stations = routes[current.route];
    if (stations) {
      const fallback = describe(stations, current, focusId) ?? describe(stations, current, null);
      if (fallback) all.push(fallback);
    }
  }

  return all
    .map(({ path, endKey, ...option }): DirectionOption => {
      const twins = all.filter((other) => other.key !== option.key && other.endKey === endKey);
      if (twins.length === 0) return { ...option, via: null };
      const elsewhere = new Set(twins.flatMap((twin) => twin.path));
      return { ...option, via: viaOf(path.filter((id) => !elsewhere.has(id))) };
    })
    .sort((a, b) => (a.side === b.side ? 0 : a.side === "left" ? -1 : 1));
}

/** A run of stops left out of a short list of them, shown as dots to expand. */
export interface HiddenStops {
  /** Where the run starts among all the stops. */
  from: number;
  count: number;
}

// A list this short shows every stop.
const maxCollapsedStops = 7;
const stopsBeforeFocus = 1;
const stopsAfterFocus = 5;
// Hiding fewer stops than this saves too little room to be worth a tap.
const minHiddenStops = 3;

/**
 * Which of a route's stops to show before the rest are expanded, in the order they're travelled:
 * the first and last, the stop before the one the line was opened from, and the five after it,
 * since those are where someone's going. A line opened from elsewhere shows all its stops.
 */
export function collapseStops(stopCount: number, focusIndex: number): (number | HiddenStops)[] {
  const all = Array.from({ length: stopCount }, (_, index) => index);
  if (focusIndex < 0 || stopCount <= maxCollapsedStops) return all;

  const shown = new Set([0, stopCount - 1]);
  for (let index = focusIndex - stopsBeforeFocus; index <= focusIndex + stopsAfterFocus; index++) {
    if (index >= 0 && index < stopCount) shown.add(index);
  }
  const kept = [...shown].sort((a, b) => a - b);

  const items: (number | HiddenStops)[] = [];
  for (const [position, index] of kept.entries()) {
    const previous = kept[position - 1];
    if (previous !== undefined) {
      const count = index - previous - 1;
      if (count >= minHiddenStops) items.push({ from: previous + 1, count });
      else for (let skipped = previous + 1; skipped < index; skipped++) items.push(skipped);
    }
    items.push(index);
  }
  return items;
}
