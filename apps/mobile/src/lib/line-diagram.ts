// The schematic at the top of the line sheet: the line's main route as a straight line, named at
// its ends below it, and where the other routes leave it above, spaced to show how it branches
// rather than where its stops are. The shape stays the same whichever route is chosen; the chosen
// one is drawn in the line's color and the rest in gray. Only the shape is laid out here, in
// points, so it can be checked without React; the sheet draws it.

/** The parts of a route the diagram needs: its stops' IDs, in order. */
export interface DiagramRoute {
  stations: readonly string[];
}

export type LabelAlign = "left" | "center" | "right";

export interface DiagramLabel {
  text: string;
  /** The left edge, the middle or the right edge, depending on `align`. */
  x: number;
  /** The top of the label. */
  y: number;
  align: LabelAlign;
  /** Labels are cut short past this width. */
  maxWidth: number;
  /** The chosen route's names are strong; the other routes' are muted. */
  isStrong: boolean;
}

export interface DiagramStop {
  stationId: string;
  routeIndex: number;
  stopIndex: number;
  x: number;
  y: number;
  /**
   * Where the chosen way starts or ends, the stop the line was opened from, another stop on it
   * (not drawn, but tappable), a named stop on a loop, the end of another route, the middle of
   * a stretch some trains take instead, or of one the chosen route takes.
   */
  kind: "terminus" | "destination" | "focus" | "stop" | "named" | "branch" | "bypass" | "via";
}

export interface LineDiagram {
  width: number;
  height: number;
  /**
   * How far down the line itself is drawn, with paths drawn around y 0 moved down by it. Termini
   * that other routes fork off near drop below it.
   */
  shift: number;
  /** The chosen route as an SVG path, in pieces where it leaves the main one, or a loop. */
  main: { type: "path"; d: string } | LoopShape;
  /** SVG paths of where the chosen route doesn't go, under it, drawn around y 0 like it. */
  branches: string[];
  stops: DiagramStop[];
  labels: DiagramLabel[];
  /** An arrowhead on the line just past the stop it was opened from, pointing the way chosen. */
  chevron: { x: number; y: number; angle: number } | null;
}

interface LoopShape {
  type: "loop";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

interface DiagramInput {
  routes: readonly DiagramRoute[];
  selected: number;
  /** Whether the chosen route is taken from its last stop to its first, right to left. */
  reversed?: boolean;
  /** The stop the line was opened from, marked on the line. */
  focusId: string | null;
  width: number;
  /** A stop's name as the sheet shows it. */
  nameOf: (id: string) => string;
  /** The stop to name a stretch only some routes take by, "Charing Cross". */
  viaOf: (ids: readonly string[]) => string | null;
}

export const LABEL_HEIGHT = 18;
// The width of an average character in the labels, to tell when two would overlap.
const CHAR_WIDTH = 7.4;
const BIG_DOT = 8;
const SMALL_DOT = 5;
// The ends of the other routes.
const BRANCH_DOT = 6;
// The ring of the stop the line was opened from.
const FOCUS_DOT = 10;
// From either side to the line's ends, so the ring, stroke and all, fits at an end.
const EDGE = FOCUS_DOT + 2;
// How far past that stop the arrowhead sits, and its radius.
const CHEVRON_OFFSET = 36;
const CHEVRON_RADIUS = 9;
// How far below the line a terminus drops where another route forks off near it.
const DROP = 30;
// Between the main line and the first branch, and between branches.
const LANE = 36;
// Added between branches stacked over each other, so the lower one's name clears the line and end
// dot of the one above.
const STACK_GAP = 8;
// Between a dot and its label.
const LABEL_GAP = 4;
// Kept between branches in the same lane.
const LANE_MARGIN = 12;
// Runs off the chosen route this many shared stops apart or fewer are one detour.
const mergeGap = 2;
// Intermediate stops get a dot only when they're at least this far apart.
const MIN_STOP_SPACING = 7;
// The narrowest the origin's name is cut down to, a few letters and an ellipsis.
const MIN_FOCUS_WIDTH = 56;

function textWidth(text: string) {
  return text.length * CHAR_WIDTH;
}

/** A run of the other route that leaves the chosen one. */
type BranchTarget = { stationId: string; routeIndex: number; stopIndex: number };

type Branch = BranchTarget & {
  /** The stops of the route it's taken from that make it up, first and last. */
  run: [number, number];
} & (
    | { type: "end"; anchor: number; side: "left" | "right"; label: string }
    | { type: "bypass"; from: number; to: number; label: string }
  );

/** Routes taking the same detour, or going to the same end on the same side, share a branch. */
function branchKey(branch: Branch): string {
  return branch.type === "end"
    ? `end:${branch.side}:${branch.label}`
    : `bypass:${branch.from}:${branch.to}`;
}

function firstIndexes(stations: readonly string[]): Map<string, number> {
  const indexOf = new Map<string, number>();
  stations.forEach((id, index) => {
    if (!indexOf.has(id)) indexOf.set(id, index);
  });
  return indexOf;
}

/**
 * The route the diagram is laid out along, whichever is chosen, so the line keeps its shape: the
 * longest, as the sheet starts out on, the one sharing the most stops with the others of those,
 * and the first of those. Loops are left out; they're drawn on their own.
 */
export function pickMainRoute(routes: readonly DiagramRoute[]): number {
  const sets = routes.map((route) => new Set(route.stations));
  let best = -1;
  let bestScore = -1;
  let bestLength = -1;
  routes.forEach(({ stations }, index) => {
    if (stations.length < 2 || stations[0] === stations.at(-1)) return;
    let score = 0;
    sets.forEach((other, otherIndex) => {
      if (otherIndex === index) return;
      for (const id of sets[index]!) if (other.has(id)) score++;
    });
    if (stations.length > bestLength || (stations.length === bestLength && score > bestScore)) {
      [best, bestScore, bestLength] = [index, score, stations.length];
    }
  });
  return best;
}

/**
 * Where a route leaves the main one: off one of its ends (a branch to another terminus) or between
 * two of its stops (a stretch some trains take instead).
 */
function routeBranches(
  input: DiagramInput,
  indexOf: ReadonlyMap<string, number>,
  route: DiagramRoute,
  routeIndex: number,
): Branch[] {
  const found: Branch[] = [];
  const positions = route.stations.map((id) => indexOf.get(id) ?? -1);
  const shared = positions.filter((position) => position >= 0);
  if (shared.length === 0) return found;
  // Whether the route runs the same way as the main one.
  const forward = shared.length < 2 || shared[0]! <= shared.at(-1)!;

  // Runs of the route off the main one. Detours only a stop or two apart are one, so a
  // stretch that touches the main route on the way reads as one; the ends stay apart, or a
  // branch would leave from the wrong stop.
  const runs: [number, number][] = [];
  const last = positions.length - 1;
  positions.forEach((position, index) => {
    if (position >= 0) return;
    const previous = runs.at(-1);
    if (previous?.[1] === index - 1) previous[1] = index;
    else runs.push([index, index]);
  });
  for (let index = runs.length - 1; index > 0; index--) {
    const [previous, next] = [runs[index - 1]!, runs[index]!];
    if (previous[0] > 0 && next[1] < last && next[0] - previous[1] - 1 <= mergeGap) {
      previous[1] = next[1];
      runs.splice(index, 1);
    }
  }

  for (const [start, end] of runs) {
    const before = start > 0 ? positions[start - 1]! : -1;
    const after = end + 1 < positions.length ? positions[end + 1]! : -1;

    let branch: Branch | null = null;
    if (before < 0 && after >= 0) {
      const label = input.nameOf(route.stations[0]!);
      branch = {
        type: "end",
        anchor: after,
        side: forward ? "left" : "right",
        label,
        stationId: route.stations[0]!,
        routeIndex,
        stopIndex: 0,
        run: [start, end],
      };
    } else if (before >= 0 && after < 0) {
      const label = input.nameOf(route.stations.at(-1)!);
      branch = {
        type: "end",
        anchor: before,
        side: forward ? "right" : "left",
        label,
        stationId: route.stations.at(-1)!,
        routeIndex,
        stopIndex: last,
        run: [start, end],
      };
    } else if (before >= 0 && after >= 0 && before !== after) {
      const off = route.stations.slice(start, end + 1).filter((id) => !indexOf.has(id));
      const label = input.viaOf(off) ?? "";
      const stationId = off.find((id) => input.nameOf(id) === label) ?? off[0]!;
      branch = {
        stationId,
        routeIndex,
        stopIndex: route.stations.indexOf(stationId),
        type: "bypass",
        from: Math.min(before, after),
        to: Math.max(before, after),
        label,
        run: [start, end],
      };
    }
    if (branch) found.push(branch);
  }
  return found;
}

/**
 * Where every other route leaves the main one. Each is listed once, however many routes share it.
 */
function findBranches(
  input: DiagramInput,
  indexOf: ReadonlyMap<string, number>,
  mainIndex: number,
): Branch[] {
  const branches = new Map<string, Branch>();
  input.routes.forEach((route, routeIndex) => {
    if (routeIndex === mainIndex) return;
    for (const branch of routeBranches(input, indexOf, route, routeIndex)) {
      // Routes taking the same detour may name it after different stops; the first one wins. A
      // terminus is shown once, from the stop nearest its end of the line.
      const key = branchKey(branch);
      const existing = branches.get(key);
      const isCloser =
        existing?.type === "end" &&
        branch.type === "end" &&
        (branch.side === "left"
          ? branch.anchor < existing.anchor
          : branch.anchor > existing.anchor);
      if (!existing || isCloser) branches.set(key, branch);
    }
  });
  return [...branches.values()];
}

export function layoutLineDiagram(input: DiagramInput): LineDiagram | null {
  const selected = input.routes[input.selected] ? input.selected : 0;
  const route = input.routes[selected];
  if (!route || route.stations.length < 2) return null;
  const isLoop = route.stations[0] === route.stations.at(-1);
  if (isLoop) return layoutLoop({ ...input, selected }, route.stations.slice(0, -1));
  // Along the line's main route, unless the chosen one barely touches it; then along its own.
  const mainIndex = pickMainRoute(input.routes);
  const main = new Set(input.routes[mainIndex]?.stations);
  const shared = route.stations.filter((id) => main.has(id)).length;
  return layoutLine({ ...input, selected }, shared >= 2 ? mainIndex : selected);
}

/** An SVG path through points. */
function toPath(points: readonly (readonly [number, number])[]): string {
  return points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join("");
}

/** The point a share of the way along a path through points. */
function pointAlong(points: readonly (readonly [number, number])[], share: number) {
  const lengths = points
    .slice(1)
    .map(([x, y], index) => Math.hypot(x - points[index]![0], y - points[index]![1]));
  let remaining = share * lengths.reduce((sum, length) => sum + length, 0);
  for (const [index, length] of lengths.entries()) {
    if (remaining <= length || index === lengths.length - 1) {
      const t = length ? Math.min(remaining / length, 1) : 0;
      const [ax, ay] = points[index]!;
      const [bx, by] = points[index + 1]!;
      return { x: ax + t * (bx - ax), y: ay + t * (by - ay) };
    }
    remaining -= length;
  }
  const [x, y] = points[0]!;
  return { x, y };
}

/** The point a share of the way along a cubic Bézier curve. */
function pointOnCurve(curve: readonly (readonly [number, number])[], t: number) {
  const u = 1 - t;
  const weights = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
  return {
    x: weights.reduce((sum, weight, index) => sum + weight * curve[index]![0], 0),
    y: weights.reduce((sum, weight, index) => sum + weight * curve[index]![1], 0),
  };
}

function labelSpan(label: DiagramLabel): [number, number] {
  const labelWidth = Math.min(textWidth(label.text), label.maxWidth);
  const from =
    label.align === "left"
      ? label.x
      : label.align === "right"
        ? label.x - labelWidth
        : label.x - labelWidth / 2;
  return [from, from + labelWidth];
}

function labelsOverlap(a: DiagramLabel, b: DiagramLabel): boolean {
  const [a1, a2] = labelSpan(a);
  const [b1, b2] = labelSpan(b);
  return a1 < b2 && b1 < a2 && a.y < b.y + LABEL_HEIGHT && b.y < a.y + LABEL_HEIGHT;
}

function layoutLine(input: DiagramInput, mainIndex: number): LineDiagram {
  const { width } = input;
  const main = input.routes[mainIndex]!.stations;
  const chosen = input.routes[input.selected]!.stations;
  const isMain = mainIndex === input.selected;
  const last = main.length - 1;
  const indexOf = firstIndexes(main);
  const chosenAt = firstIndexes(chosen);
  const focusId = input.focusId !== null && chosenAt.has(input.focusId) ? input.focusId : null;
  const focus = focusId === null ? -1 : (indexOf.get(focusId) ?? -1);
  const branches = findBranches(input, indexOf, mainIndex);
  // The branches the chosen route takes, by the one drawn for them.
  const taken = new Map(
    isMain
      ? []
      : routeBranches(input, indexOf, input.routes[input.selected]!, input.selected).map(
          (branch) => [branchKey(branch), branch] as const,
        ),
  );

  // The diagram shows how the line branches, not how far apart its stops are: the stops where
  // other routes leave it split it into stretches of equal width, and the stops along each are
  // spread evenly over it. Where branches leave from stops too close together for their slopes to
  // fit that way, the stretches are sized more and more by their stops instead, and as a last
  // resort, the branches are stacked closer.
  const keys = [
    ...new Set([
      0,
      last,
      ...branches.flatMap((branch) =>
        branch.type === "end" ? [branch.anchor] : [branch.from, branch.to],
      ),
    ]),
  ].sort((a, b) => a - b);
  const tries = [
    [1, STACK_GAP],
    [0.5, STACK_GAP],
    [0, STACK_GAP],
    [0, 0],
  ] as const;
  const layouts = tries.map(([evenness, stackGap]) => {
    /** How far above the line a branch runs in a lane, counted from 1. */
    const riseOf = (lane: number) => lane * LANE + (lane - 1) * stackGap;
    /** How far along the line a stop is drawn, from 0 at its first to 1 at its last. */
    const share = (index: number) => {
      const next = Math.max(
        keys.findIndex((key) => key >= index),
        1,
      );
      const [from, to] = [keys[next - 1]!, keys[next]!];
      const even = (next - 1 + (index - from) / (to - from)) / (keys.length - 1);
      return evenness * even + (1 - evenness) * (index / last);
    };

    // Lanes first, from where each branch would be with the line edge to edge: the shortest ones
    // nearest the line, and two in the same lane only when they're well apart.
    const roughX = (index: number) => share(index) * width;
    const spans = branches.map((branch) => {
      if (branch.type === "end") {
        return branch.side === "left"
          ? [0, Math.max(roughX(branch.anchor), textWidth(branch.label))]
          : [Math.min(roughX(branch.anchor), width - textWidth(branch.label)), width];
      }
      const middle = (roughX(branch.from) + roughX(branch.to)) / 2;
      const half = textWidth(branch.label) / 2;
      return [
        Math.min(roughX(branch.from), middle - half),
        Math.max(roughX(branch.to), middle + half),
      ];
    }) as [number, number][];
    const order = branches
      .map((_, index) => index)
      .sort((a, b) => spans[a]![1] - spans[a]![0] - (spans[b]![1] - spans[b]![0]));
    const lanes: [number, number][][] = [];
    const laneOf: number[] = [];
    for (const index of order) {
      const [from, to] = spans[index]!;
      let lane = lanes.findIndex((taken) =>
        taken.every(([a, b]) => to + LANE_MARGIN <= a || from >= b + LANE_MARGIN),
      );
      if (lane < 0) lane = lanes.push([]) - 1;
      lanes[lane]!.push([from, to]);
      laneOf[index] = lane + 1;
    }

    // A branch leaving near an end needs room for its slope past the line's end.
    let insetLeft = 0;
    let insetRight = 0;
    for (let pass = 0; pass < 3; pass++) {
      const span = width - 2 * EDGE - insetLeft - insetRight;
      branches.forEach((branch, index) => {
        if (branch.type !== "end") return;
        const slope = riseOf(laneOf[index]!);
        const x = EDGE + insetLeft + share(branch.anchor) * span;
        if (branch.side === "left") insetLeft = Math.max(insetLeft, slope + EDGE - x);
        else insetRight = Math.max(insetRight, x + slope + EDGE - width);
      });
    }
    const left = EDGE + insetLeft;
    const right = width - EDGE - insetRight;
    const xOf = (index: number) => left + share(index) * (right - left);
    const fits = branches.every((branch, index) => {
      if (branch.type !== "end") return true;
      const bend = xOf(branch.anchor) + (branch.side === "left" ? -1 : 1) * riseOf(laneOf[index]!);
      return bend >= EDGE - 0.5 && bend <= width - EDGE + 0.5;
    });
    return { laneOf, riseOf, left, right, xOf, fits };
  });
  const { laneOf, riseOf, left, right, xOf } =
    layouts.find((layout) => layout.fits) ?? layouts.at(-1)!;

  // Laid out around the line at y 0, and moved down to fit at the end. Where another route forks
  // off near an end, the chosen one drops below the line to that end as the other rises above it.
  const anchors = (side: "left" | "right") =>
    branches.flatMap((branch) =>
      branch.type === "end" && branch.side === side && branch.anchor > 0 && branch.anchor < last
        ? [branch.anchor]
        : [],
    );
  let forkLeft = Math.min(...anchors("left"));
  let forkRight = Math.max(...anchors("right"));
  // Forks that cross over each other are left as branches off a straight line.
  if (forkLeft >= forkRight) [forkLeft, forkRight] = [Infinity, -Infinity];
  const points: [number, number][] = [];
  if (Number.isFinite(forkLeft)) {
    const forkX = xOf(forkLeft);
    const bendX = forkX - LANE;
    points.push([Math.min(left, bendX), DROP]);
    if (bendX > left) points.push([bendX, DROP]);
    points.push([forkX, 0]);
  } else points.push([left, 0]);
  if (Number.isFinite(forkRight)) {
    const forkX = xOf(forkRight);
    const bendX = forkX + LANE;
    points.push([forkX, 0]);
    if (bendX < right) points.push([bendX, DROP]);
    points.push([Math.max(right, bendX), DROP]);
  } else points.push([right, 0]);
  const first = points[0]!;
  const end = points.at(-1)!;
  /** Where the chosen route is at a point along it, and which way it's heading there. */
  const along = (x: number) => {
    const found = points.findIndex(([px]) => px >= x);
    const next = found < 0 ? points.length - 1 : Math.max(found, 1);
    const [ax, ay] = points[next - 1]!;
    const [bx, by] = points[next] ?? points[next - 1]!;
    const t = bx === ax ? 0 : Math.min(Math.max((x - ax) / (bx - ax), 0), 1);
    return { y: ay + t * (by - ay), angle: (Math.atan2(by - ay, bx - ax) * 180) / Math.PI };
  };

  /** Where a stop of the main route is drawn: its ends where the line ends, which may drop. */
  const xAt = (index: number) => (index === 0 ? first[0] : index === last ? end[0] : xOf(index));

  // The stretches of the main route the chosen one runs along, by stop. A branch drawn from nearer
  // the end than the chosen route leaves at is reached along the main line.
  let spans: [number, number][] = [];
  if (isMain) spans = [[0, last]];
  else {
    for (let index = 1; index < chosen.length; index++) {
      const a = indexOf.get(chosen[index - 1]!);
      const b = indexOf.get(chosen[index]!);
      if (a !== undefined && b !== undefined && a !== b) {
        spans.push([Math.min(a, b), Math.max(a, b)]);
      }
    }
    for (const branch of branches) {
      const own = taken.get(branchKey(branch));
      if (own?.type === "end" && branch.type === "end" && own.anchor !== branch.anchor) {
        spans.push([Math.min(own.anchor, branch.anchor), Math.max(own.anchor, branch.anchor)]);
      }
    }
    spans.sort((a, b) => a[0] - b[0]);
    spans = spans.reduce<[number, number][]>((merged, span) => {
      const previous = merged.at(-1);
      if (previous && span[0] <= previous[1]) previous[1] = Math.max(previous[1], span[1]);
      else merged.push([...span]);
      return merged;
    }, []);
  }
  const isWhole = spans.length === 1 && spans[0]![0] === 0 && spans[0]![1] === last;
  const ranges = spans.map(([a, b]) => [xAt(a), xAt(b)] as const);

  // The chosen route in the line's color over the main one in gray, where it doesn't run along all
  // of it.
  const paths: string[] = [];
  const chosenPaths: string[] = [];
  if (isWhole) chosenPaths.push(toPath(points));
  else {
    paths.push(toPath(points));
    for (const [from, to] of ranges) {
      chosenPaths.push(
        toPath([
          [from, along(from).y],
          ...points.filter(([x]) => x > from && x < to),
          [to, along(to).y],
        ]),
      );
    }
  }

  const half = width / 2 - LABEL_GAP;
  const destinationId = input.reversed ? chosen[0]! : chosen.at(-1)!;
  const kindOf = (id: string) =>
    id === focusId ? "focus" : id === destinationId ? "destination" : "terminus";
  const isChosenEnd = (id: string) => id === chosen[0] || id === chosen.at(-1);
  const stops: DiagramStop[] = [];
  const labels: DiagramLabel[] = [];
  /** A stop of the main route, on the chosen one where that stops there too. */
  const target = (index: number) => {
    const stationId = main[index]!;
    const at = chosenAt.get(stationId);
    return at === undefined
      ? { stationId, routeIndex: mainIndex, stopIndex: index }
      : { stationId, routeIndex: input.selected, stopIndex: at };
  };
  // Where the chosen route ends partway along the main one.
  const chosenEnds = [...new Set([chosen[0]!, chosen.at(-1)!])].flatMap((id) => {
    const index = indexOf.get(id);
    return index !== undefined && index > 0 && index < last ? [index] : [];
  });

  // The other stops aren't drawn, but each can be tapped where it would be, if it isn't crowded.
  for (let index = 1; index < last; index++) {
    const x = xOf(index);
    const room = Math.min(x - xOf(index - 1), xOf(index + 1) - x);
    if (index !== focus && !chosenEnds.includes(index) && room >= MIN_STOP_SPACING) {
      stops.push({ ...target(index), x, y: along(x).y, kind: "stop" });
    }
  }
  // The main route's ends, gray where the chosen route doesn't reach.
  const endKind = (index: number) => {
    const id = main[index]!;
    if (!chosenAt.has(id)) return "branch";
    return id === focusId || isChosenEnd(id) ? kindOf(id) : "terminus";
  };
  // Named strongly where the chosen route starts or ends, not where it only passes.
  const isStrongEnd = (index: number) => {
    const id = main[index]!;
    return chosenAt.has(id) && (id === focusId || isChosenEnd(id));
  };
  stops.push({ ...target(0), x: first[0], y: first[1], kind: endKind(0) });
  stops.push({ ...target(last), x: end[0], y: end[1], kind: endKind(last) });
  // The termini are named under their dots.
  const firstName = input.nameOf(main[0]!);
  const lastName = input.nameOf(main[last]!);
  const endLabel = (index: number, [x, y]: [number, number]) => ({
    x: index === 0 ? x - EDGE : x + EDGE,
    y: y + (focus === index ? FOCUS_DOT : BIG_DOT) + LABEL_GAP,
  });
  labels.push(
    {
      text: firstName,
      ...endLabel(0, first),
      align: "left",
      maxWidth: half,
      isStrong: isStrongEnd(0),
    },
    {
      text: lastName,
      ...endLabel(last, end),
      align: "right",
      maxWidth: half,
      isStrong: isStrongEnd(last),
    },
  );

  // What the origin's name has to keep clear of, next to the line above it and below it.
  const band = FOCUS_DOT + LABEL_GAP + LABEL_HEIGHT;
  const above: [number, number][] = [];
  const endNames: [number, number][] = [
    [labels[0]!.x, labels[0]!.x + Math.min(textWidth(firstName), half)],
    [labels[1]!.x - Math.min(textWidth(lastName), half), labels[1]!.x],
  ];
  const below: [number, number][] = [
    first[1] > 0 ? [first[0] - BIG_DOT, xOf(forkLeft)] : endNames[0]!,
    end[1] > 0 ? [xOf(forkRight), end[0] + BIG_DOT] : endNames[1]!,
  ];

  // Where the chosen route ends partway, named under its dot when there's room.
  for (const index of chosenEnds) {
    if (index === focus) continue;
    const x = xOf(index);
    const { y } = along(x);
    stops.push({ ...target(index), x, y, kind: kindOf(main[index]!) });
    const text = input.nameOf(main[index]!);
    const labelWidth = Math.min(textWidth(text), half);
    const label: DiagramLabel = {
      text,
      x: Math.min(Math.max(x, labelWidth / 2), width - labelWidth / 2),
      y: y + BIG_DOT + LABEL_GAP,
      align: "center",
      maxWidth: labelWidth,
      isStrong: true,
    };
    if (labels.every((other) => !labelsOverlap(label, other))) {
      labels.push(label);
      below.push(labelSpan(label));
    }
  }

  /**
   * The chosen route's stops along a branch it takes, a share of the way along it each, the
   * stop the line was opened from among them.
   */
  type Point = { x: number; y: number };
  // Where an arrowhead could go along the branches the chosen route takes, pointing the way it's
  // taken there, for when there's no room for it on the main line.
  // Each branch's spots come best first.
  const branchArrows: (Point & { angle: number })[][] = [];
  type BranchFocus = Point & {
    share: number;
    length: number;
    branch: Branch;
    at: (share: number) => Point;
  };
  let branchFocus: BranchFocus | null = null;
  const placeAlong = (branch: Branch, skip: number, at: (share: number) => Point, length = 0) => {
    const [start, stop] = branch.run;
    // Off an end, the stops are counted out from where it leaves the main route.
    const fromStart = start === 0 && branch.type === "end";
    const count = stop - start + (branch.type === "end" ? 1 : 2);
    for (let index = start; index <= stop; index++) {
      const id = chosen[index]!;
      if (index === skip || indexOf.has(id)) continue;
      const rank = fromStart ? stop - index + 1 : index - start + 1;
      const point = at(rank / count);
      const isFocus = id === focusId;
      if (isFocus) branchFocus = { ...point, share: rank / count, length, branch, at };
      stops.push({
        stationId: id,
        routeIndex: input.selected,
        stopIndex: index,
        ...point,
        kind: isFocus ? "focus" : "stop",
      });
    }
  };

  branches.forEach((branch, index) => {
    const lane = laneOf[index]!;
    const rise = riseOf(lane);
    const own = taken.get(branchKey(branch));

    if (branch.type === "end") {
      const anchorX = xOf(branch.anchor);
      const direction = branch.side === "left" ? -1 : 1;
      const bendX = anchorX + direction * rise;
      const endX = branch.side === "left" ? Math.min(left, bendX) : Math.max(right, bendX);
      const corners: [number, number][] = [
        [anchorX, 0],
        [bendX, -rise],
        [endX, -rise],
      ];
      (own ? chosenPaths : paths).push(toPath(corners));
      above.push(direction < 0 ? [anchorX - band, anchorX] : [anchorX, anchorX + band]);
      let dot = BRANCH_DOT;
      if (own?.type === "end") {
        const kind = kindOf(own.stationId);
        dot = kind === "focus" ? FOCUS_DOT : BIG_DOT;
        stops.push({
          stationId: own.stationId,
          routeIndex: input.selected,
          stopIndex: own.stopIndex,
          x: endX,
          y: -rise,
          kind,
        });
        placeAlong(
          own,
          own.stopIndex,
          (share) => pointAlong(corners, share),
          rise * Math.SQRT2 + Math.abs(endX - bendX),
        );
        // Midway along its level stretch, unless that's too short, then along its slope.
        const turn = own.stationId === destinationId ? 0 : 180;
        const segment = ([ax, ay]: [number, number], [bx, by]: [number, number], t: number) => ({
          x: ax + t * (bx - ax),
          y: ay + t * (by - ay),
          angle: (Math.atan2(by - ay, bx - ax) * 180) / Math.PI + turn,
        });
        // Room for the arrowhead midway with a clear gap to the bend and to the end's dot.
        const isLong = Math.abs(endX - bendX) >= 2 * (2 * CHEVRON_RADIUS + BIG_DOT + LABEL_GAP * 2);
        branchArrows.push([
          ...(isLong ? [segment(corners[1], corners[2], 0.5)] : []),
          ...[0.5, 0.35, 0.65].map((t) => segment(corners[0], corners[1], t)),
        ]);
      } else stops.push({ ...branch, x: endX, y: -rise, kind: "branch" });
      labels.push({
        text: branch.label,
        x: branch.side === "left" ? endX - EDGE : endX + EDGE,
        y: -rise - dot - LABEL_GAP - LABEL_HEIGHT,
        align: branch.side,
        maxWidth: half,
        isStrong: own !== undefined,
      });
      return;
    }

    // A stretch some trains take instead arcs over the line, with a dot at its top.
    const fromX = xOf(branch.from);
    const toX = xOf(branch.to);
    const pull = Math.min(rise * 0.7, (toX - fromX) / 3);
    const curve: [number, number][] = [
      [fromX, 0],
      [fromX + pull, -rise],
      [toX - pull, -rise],
      [toX, 0],
    ];
    (own ? chosenPaths : paths).push(
      `M${fromX} 0C${fromX + pull} ${-rise} ${toX - pull} ${-rise} ${toX} 0`,
    );
    const top = -rise * 0.75;
    if (-top - BRANCH_DOT < band) above.push([fromX, toX]);
    else above.push([fromX, fromX + pull], [toX - pull, toX]);
    const middle = (fromX + toX) / 2;
    if (own?.type === "bypass") {
      const via = own.stationId === focusId ? -1 : own.stopIndex;
      if (via >= 0) {
        stops.push({
          stationId: own.stationId,
          routeIndex: input.selected,
          stopIndex: via,
          x: middle,
          y: top,
          kind: "via",
        });
      }
      placeAlong(own, via, (share) => pointOnCurve(curve, share));
      // Partway up the arc from where it's taken from, clear of the dot at its top.
      branchArrows.push(
        [0.25, 0.2, 0.3].map((share) => {
          const t = input.reversed ? 1 - share : share;
          const [a, b] = [pointOnCurve(curve, t - 0.01), pointOnCurve(curve, t + 0.01)];
          const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
          return { ...pointOnCurve(curve, t), angle: input.reversed ? angle + 180 : angle };
        }),
      );
    } else stops.push({ ...branch, x: middle, y: top, kind: "bypass" });
    if (branch.label) {
      const labelWidth = Math.min(textWidth(branch.label), width);
      labels.push({
        text: branch.label,
        x: Math.min(Math.max(middle, labelWidth / 2), width - labelWidth / 2),
        y: top - BRANCH_DOT - LABEL_GAP - LABEL_HEIGHT,
        align: "center",
        maxWidth: width,
        isStrong: own !== undefined,
      });
    }
  });
  const chosenEnd = (id: string) => isChosenEnd(id) && !indexOf.has(id);

  // The stop it was opened from, named over its dot or under it, where nothing else is, and a
  // little to one side when it sits where another route leaves.
  if (focus > 0 && focus < last) {
    const x = xOf(focus);
    const { y } = along(x);
    stops.push({ ...target(focus), x, y, kind: "focus" });
    // Down where the line drops to a forked end, it only has the ends' names under it, and the
    // slope back up next to it.
    const dropped = y > 0;
    const over: [number, number][] = !dropped
      ? above
      : x < (left + right) / 2
        ? [[xOf(forkLeft) - LANE, width]]
        : [[0, xOf(forkRight) + LANE]];
    const under = dropped ? endNames : below;
    const name = input.nameOf(main[focus]!);
    // Strong, so a little wider than the average character allows for.
    const fullWidth = Math.min(textWidth(name) * 1.1 + 8, width * 0.6);
    // Centred on the dot, lined up with either side of it, or right up against whatever is next to
    // it, as long as the name still starts or ends by the dot.
    const reach = FOCUS_DOT + LABEL_GAP * 2;
    const pick = (
      taken: { over: [number, number][]; under: [number, number][] },
      labelWidth = fullWidth,
    ) => {
      const fit = (from: number) => Math.min(Math.max(from, 0), width - labelWidth);
      const isClear = (from: number, spans: [number, number][]) =>
        spans.every(([a, b]) => from + labelWidth + LABEL_GAP <= a || from >= b + LABEL_GAP);
      const distance = (from: number) => Math.max(0, from - x, x - (from + labelWidth));
      const choices = [-1, 1].flatMap((side) => {
        const spans = side < 0 ? taken.over : taken.under;
        const starts = [
          x - labelWidth / 2,
          x - FOCUS_DOT,
          x + FOCUS_DOT - labelWidth,
          ...spans.flatMap(([a, b]) => [b + LABEL_GAP, a - LABEL_GAP - labelWidth]),
        ].map(fit);
        return starts
          .filter((from) => distance(from) <= reach && isClear(from, spans))
          .map((from) => ({ from, side, labelWidth, off: Math.abs(from + labelWidth / 2 - x) }));
      });
      // The most centred, over the line when it's a tie.
      return choices.sort((a, b) => a.off - b.off || a.side - b.side)[0];
    };
    let best = pick({ over, under });
    // Hemmed in by the name of the end it's leaving from, it takes that name's place. The stops
    // below still start there.
    const behind = input.reversed ? 1 : 0;
    if (!best && (dropped || (behind === 0 ? first : end)[1] === 0)) {
      best = pick({ over, under: under.filter((_, index) => index !== behind) });
      if (best) labels.splice(behind, 1);
    }
    // Squeezed between forks, a long name is cut short.
    for (let labelWidth = fullWidth * 0.8; !best && labelWidth >= MIN_FOCUS_WIDTH; labelWidth -= 16)
      best = pick({ over, under }, labelWidth);
    if (best) {
      labels.push({
        text: name,
        x: best.from + best.labelWidth / 2,
        y: y + (best.side < 0 ? -band : FOCUS_DOT + LABEL_GAP),
        align: "center",
        maxWidth: best.labelWidth,
        isStrong: true,
      });
    }
  }
  // Opened from a stop along a branch the chosen route takes, it's named under its dot or over it,
  // where nothing else is. At the branch's end, the end's name already is it.
  // Set while placing the branches, which TypeScript can't follow.
  const onBranch = branchFocus as BranchFocus | null;
  if (focusId !== null && onBranch && !chosenEnd(focusId)) {
    const text = input.nameOf(focusId);
    const labelWidth = Math.min(textWidth(text) * 1.1 + 8, width * 0.6);
    const x = Math.min(Math.max(onBranch.x, labelWidth / 2), width - labelWidth / 2);
    for (const y of [
      onBranch.y + FOCUS_DOT + LABEL_GAP,
      onBranch.y - FOCUS_DOT - LABEL_GAP - LABEL_HEIGHT,
    ]) {
      const label: DiagramLabel = {
        text,
        x,
        y,
        align: "center",
        maxWidth: labelWidth,
        isStrong: true,
      };
      if (labels.every((other) => !labelsOverlap(label, other))) {
        labels.push(label);
        break;
      }
    }
  }

  // An arrowhead just past the stop it was opened from, or midway along without one, when it fits:
  // on a straight stretch of the chosen route along the main one, clear of the bends and of where
  // other routes leave, moved along a little if it has to be. Failing that, anywhere clear of them,
  // and failing that, where it would be. Opened from along a branch, it's past where the chosen
  // route next meets the main one, if it does.
  let chevron: LineDiagram["chevron"] = null;
  const sign = input.reversed ? -1 : 1;
  let start: number | null = null;
  if (focus >= 0) start = xOf(focus) + sign * CHEVRON_OFFSET;
  else if (focusId !== null) {
    const at = chosenAt.get(focusId)!;
    const ahead = input.reversed ? chosen.slice(0, at).reverse() : chosen.slice(at + 1);
    const next = ahead.find((id) => indexOf.has(id));
    if (next !== undefined) start = xAt(indexOf.get(next)!);
  } else if (isWhole) start = (left + right) / 2;
  else {
    const [a, b] = ranges.reduce(
      (longest, range) => (range[1] - range[0] > longest[1] - longest[0] ? range : longest),
      [0, 0] as const,
    );
    start = (a + b) / 2;
  }
  if (start !== null && ranges.length > 0) {
    const from = start;
    const corners = [
      ...points.slice(1, -1).map(([x]) => x),
      ...branches.flatMap((branch) =>
        branch.type === "end" ? [xOf(branch.anchor)] : [xOf(branch.from), xOf(branch.to)],
      ),
    ];
    const fits = (x: number) =>
      ranges.some(
        ([a, b]) => x - CHEVRON_RADIUS - BIG_DOT >= a && x + CHEVRON_RADIUS + BIG_DOT <= b,
      ) &&
      (focus >= 0
        ? sign * (x - xOf(focus)) >= FOCUS_DOT + CHEVRON_RADIUS + LABEL_GAP
        : focusId === null || sign * (x - from) >= 0);
    const isClear = (x: number) =>
      corners.every((corner) => Math.abs(corner - x) >= CHEVRON_RADIUS * 2 + LABEL_GAP);
    const candidates = Array.from({ length: Math.ceil(width / 4) }, (_, step) => [
      from + sign * step * 4,
      from - sign * step * 4,
    ])
      .flat()
      .filter(fits);
    const chevronX =
      candidates.find((x) => isClear(x) && along(x).angle === 0) ??
      candidates.find(isClear) ??
      (fits(from) ? from : null);
    if (chevronX !== null) {
      const { y, angle } = along(chevronX);
      chevron = { x: chevronX, y, angle: input.reversed ? angle + 180 : angle };
    }
  } else if (onBranch?.branch.type === "end" && onBranch.branch.stationId === destinationId) {
    // Out along a branch to its end, it's midway between the two, where there's room.
    const { length } = onBranch;
    const room = (1 - onBranch.share) * length;
    if (room >= FOCUS_DOT + BIG_DOT + 2 * (CHEVRON_RADIUS + LABEL_GAP)) {
      const share = (onBranch.share + 1) / 2;
      const nudge = 1 / length;
      const [a, b] = [onBranch.at(share - nudge), onBranch.at(share + nudge)];
      chevron = {
        ...onBranch.at(share),
        angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
      };
    }
  }
  // Without room on the main line, on the nearest branch the chosen route takes next, where it's
  // clear of the names.
  const fromX = focus >= 0 ? xOf(focus) : onBranch ? onBranch.x : null;
  if (!chevron && fromX !== null) {
    const isAhead = (arrow: Point) =>
      sign * (arrow.x - fromX) >= FOCUS_DOT + CHEVRON_RADIUS + LABEL_GAP;
    const isClear = (arrow: Point) =>
      labels.every((label) => {
        const [a, b] = labelSpan(label);
        return (
          arrow.x + CHEVRON_RADIUS <= a ||
          arrow.x - CHEVRON_RADIUS >= b ||
          arrow.y + CHEVRON_RADIUS <= label.y ||
          arrow.y - CHEVRON_RADIUS >= label.y + LABEL_HEIGHT
        );
      });
    const nearest = branchArrows
      .filter((spots) => isAhead(spots[0]!))
      .sort((a, b) => sign * (a[0]!.x - b[0]!.x));
    for (const spots of nearest) {
      chevron = spots.find((spot) => isAhead(spot) && isClear(spot)) ?? null;
      if (chevron) break;
    }
  }

  // Moved down so the highest name starts at the top.
  const tops = [...labels.map((label) => label.y), ...stops.map((stop) => stop.y - EDGE)];
  const bottoms = [
    ...labels.map((label) => label.y + LABEL_HEIGHT),
    ...stops.map((stop) => stop.y + EDGE),
  ];
  const shift = -Math.min(...tops);
  return {
    width,
    height: Math.max(...bottoms) + shift + 2,
    shift,
    main: { type: "path", d: chosenPaths.join("") },
    branches: paths,
    stops: stops.map((stop) => ({ ...stop, y: stop.y + shift })),
    labels: labels.map((label) => ({ ...label, y: label.y + shift })),
    chevron: chevron && { ...chevron, y: chevron.y + shift },
  };
}

/**
 * A loop as an ellipse, with four of its stops named around it: the one the line was opened
 * from (or where the loop starts) on the right, and the stops a quarter of the way round from it.
 */
function layoutLoop(input: DiagramInput, stations: readonly string[]): LineDiagram {
  const { width } = input;
  const count = stations.length;
  const focus = input.focusId ? stations.indexOf(input.focusId) : -1;
  const start = Math.max(focus, 0);
  const sideRoom = Math.min(130, width / 2 - 60);
  const rx = width / 2 - sideRoom;
  const ry = 36;
  const cx = width / 2;
  const cy = LABEL_HEIGHT + LABEL_GAP + ry;
  const sideWidth = sideRoom - BIG_DOT - LABEL_GAP * 2;
  const labelY = cy - LABEL_HEIGHT / 2;

  const stops: DiagramStop[] = [];
  const labels: DiagramLabel[] = [];
  const quarters = [0, 1, 2, 3].map(
    (quarter) => (start + Math.round((quarter * count) / 4)) % count,
  );
  // Clockwise from the right: right, bottom, left, top.
  const places = [
    { x: cx + rx, y: cy, label: { x: cx + rx + BIG_DOT + LABEL_GAP, y: labelY, align: "left" } },
    { x: cx, y: cy + ry, label: { x: cx, y: cy + ry + SMALL_DOT + LABEL_GAP, align: "center" } },
    { x: cx - rx, y: cy, label: { x: cx - rx - BIG_DOT - LABEL_GAP, y: labelY, align: "right" } },
    {
      x: cx,
      y: cy - ry,
      label: { x: cx, y: cy - ry - SMALL_DOT - LABEL_GAP - LABEL_HEIGHT, align: "center" },
    },
  ] as const;
  // Each of the loop's stops on the ellipse, clockwise in the order the route lists them.
  if ((2 * Math.PI * Math.min(rx, ry)) / count >= MIN_STOP_SPACING) {
    for (let index = 0; index < count; index++) {
      if (quarters.includes(index)) continue;
      const angle = (2 * Math.PI * (index - start)) / count;
      stops.push({
        stationId: stations[index]!,
        routeIndex: input.selected,
        stopIndex: index,
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
        kind: "stop",
      });
    }
  }
  quarters.forEach((index, quarter) => {
    const place = places[quarter]!;
    const isFocus = quarter === 0 && focus >= 0;
    stops.push({
      stationId: stations[index]!,
      routeIndex: input.selected,
      stopIndex: index,
      x: place.x,
      y: place.y,
      kind: isFocus ? "focus" : "named",
    });
    if (isFocus) return;
    labels.push({
      text: input.nameOf(stations[index]!),
      x: place.label.x,
      y: place.label.y,
      align: place.label.align,
      maxWidth: quarter % 2 === 0 ? sideWidth : width,
      isStrong: isFocus,
    });
  });

  return {
    width,
    height: cy + ry + SMALL_DOT + LABEL_GAP + LABEL_HEIGHT + 2,
    shift: 0,
    main: { type: "loop", cx, cy, rx, ry },
    branches: [],
    stops,
    labels,
    chevron: null,
  };
}
