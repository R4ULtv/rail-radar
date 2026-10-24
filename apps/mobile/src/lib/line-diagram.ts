// The schematic at the top of the line sheet: the chosen route as a straight line in the line's
// color, and where the other routes leave it in gray below. Only the shape is laid out here, in
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
  x: number;
  y: number;
  /** A stop on the chosen route, a named one on a loop, or the end of another route. */
  kind: "terminus" | "focus" | "stop" | "named" | "branch";
}

export interface LineDiagram {
  width: number;
  height: number;
  /** The chosen route: a polyline, or an ellipse for a loop. */
  main: { type: "line"; from: [number, number]; to: [number, number] } | LoopShape;
  /** SVG paths of the other routes, under the main line. */
  branches: string[];
  stops: DiagramStop[];
  labels: DiagramLabel[];
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
  /** The stop the line was opened from, marked and named on the line. */
  focusId: string | null;
  width: number;
  /** A stop's name as the sheet shows it. */
  nameOf: (id: string) => string;
  /** The stop to name a stretch only some routes take by, "Charing Cross". */
  viaOf: (ids: readonly string[]) => string | null;
}

export const LABEL_HEIGHT = 16;
// The width of an average character in the labels, to tell when two would overlap.
const CHAR_WIDTH = 6.8;
const BIG_DOT = 8;
const SMALL_DOT = 5;
// Between the main line and the first branch, and between branches.
const LANE = 36;
// Between a dot and its label.
const LABEL_GAP = 4;
// Kept between branches in the same lane.
const LANE_MARGIN = 12;
// Runs off the chosen route this many shared stops apart or fewer are one detour.
const mergeGap = 2;
// Intermediate stops get a dot only when they're at least this far apart.
const MIN_STOP_SPACING = 7;

function textWidth(text: string) {
  return text.length * CHAR_WIDTH;
}

/** A run of the other route that leaves the chosen one. */
type Branch =
  | { type: "end"; anchor: number; side: "left" | "right"; label: string }
  | { type: "bypass"; from: number; to: number; label: string };

/**
 * Where every other route leaves the chosen one: off one of its ends (a branch to another
 * terminus) or between two of its stops (a stretch some trains take instead). Each is listed once,
 * however many routes share it.
 */
function findBranches(input: DiagramInput, main: readonly string[]): Branch[] {
  const indexOf = new Map(main.map((id, index) => [id, index]));
  const branches = new Map<string, Branch>();

  input.routes.forEach((route, routeIndex) => {
    if (routeIndex === input.selected) return;
    const positions = route.stations.map((id) => indexOf.get(id) ?? -1);
    const shared = positions.filter((position) => position >= 0);
    if (shared.length === 0) return;
    // Whether the route runs the same way as the chosen one.
    const forward = shared.length < 2 || shared[0]! <= shared.at(-1)!;

    // Runs of the route off the chosen one. Detours only a stop or two apart are one, so a
    // stretch that touches the chosen route on the way reads as one; the ends stay apart, or a
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
        branch = { type: "end", anchor: after, side: forward ? "left" : "right", label };
      } else if (before >= 0 && after < 0) {
        const label = input.nameOf(route.stations.at(-1)!);
        branch = { type: "end", anchor: before, side: forward ? "right" : "left", label };
      } else if (before >= 0 && after >= 0 && before !== after) {
        const off = route.stations.slice(start, end + 1).filter((id) => !indexOf.has(id));
        branch = {
          type: "bypass",
          from: Math.min(before, after),
          to: Math.max(before, after),
          label: input.viaOf(off) ?? "",
        };
      }
      if (!branch) continue;
      // Routes taking the same detour may name it after different stops; the first one wins. A
      // terminus is shown once, from the stop nearest its end of the line.
      const key =
        branch.type === "end"
          ? `end:${branch.side}:${branch.label}`
          : `bypass:${branch.from}:${branch.to}`;
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
  const route = input.routes[input.selected] ?? input.routes[0];
  if (!route || route.stations.length < 2) return null;
  const isLoop = route.stations[0] === route.stations.at(-1);
  return isLoop
    ? layoutLoop(input, route.stations.slice(0, -1))
    : layoutLine(input, route.stations);
}

function layoutLine(input: DiagramInput, main: readonly string[]): LineDiagram {
  const { width } = input;
  const last = main.length - 1;
  const focus = input.focusId ? main.indexOf(input.focusId) : -1;
  const branches = findBranches(input, main);

  // Lanes first, from where each branch would be with the line edge to edge: the shortest ones
  // nearest the line, and two in the same lane only when they're well apart.
  const roughX = (index: number) => (index / last) * width;
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
    const span = width - 2 * BIG_DOT - insetLeft - insetRight;
    branches.forEach((branch, index) => {
      if (branch.type !== "end") return;
      const slope = laneOf[index]! * LANE;
      const x = BIG_DOT + insetLeft + (branch.anchor / last) * span;
      if (branch.side === "left") insetLeft = Math.max(insetLeft, slope + SMALL_DOT - x);
      else insetRight = Math.max(insetRight, x + slope + SMALL_DOT - width);
    });
  }
  const left = BIG_DOT + insetLeft;
  const right = width - BIG_DOT - insetRight;
  const xOf = (index: number) => left + (index / last) * (right - left);

  // The termini's names above their ends, and the stop the line was opened from's above it, a
  // row higher when it would run into either.
  const firstName = input.nameOf(main[0]!);
  const lastName = input.nameOf(main[last]!);
  const half = width / 2 - LABEL_GAP;
  const firstWidth = Math.min(textWidth(firstName), half);
  const lastWidth = Math.min(textWidth(lastName), half);
  const hasFocusLabel = focus > 0 && focus < last;
  let focusRow = 0;
  let focusLeft = 0;
  let focusWidth = 0;
  if (hasFocusLabel) {
    const focusName = input.nameOf(main[focus]!);
    focusWidth = Math.min(textWidth(focusName), width);
    focusLeft = Math.min(Math.max(xOf(focus) - focusWidth / 2, 0), width - focusWidth);
    const clear =
      focusLeft >= left - BIG_DOT + firstWidth + LABEL_GAP * 2 &&
      focusLeft + focusWidth <= right + BIG_DOT - lastWidth - LABEL_GAP * 2;
    if (!clear) focusRow = 1;
  }
  const mainY = (focusRow + 1) * LABEL_HEIGHT + LABEL_GAP + BIG_DOT;

  const labels: DiagramLabel[] = [
    {
      text: firstName,
      x: left - BIG_DOT,
      y: mainY - BIG_DOT - LABEL_GAP - LABEL_HEIGHT,
      align: "left",
      maxWidth: half,
      isStrong: true,
    },
    {
      text: lastName,
      x: right + BIG_DOT,
      y: mainY - BIG_DOT - LABEL_GAP - LABEL_HEIGHT,
      align: "right",
      maxWidth: half,
      isStrong: true,
    },
  ];
  if (hasFocusLabel) {
    labels.push({
      text: input.nameOf(main[focus]!),
      x: focusLeft + focusWidth / 2,
      y: mainY - BIG_DOT - LABEL_GAP - LABEL_HEIGHT * (focusRow + 1),
      align: "center",
      maxWidth: width,
      isStrong: true,
    });
  }

  const stops: DiagramStop[] = [];
  const spacing = (right - left) / last;
  if (spacing >= MIN_STOP_SPACING) {
    for (let index = 1; index < last; index++) {
      if (index !== focus) stops.push({ x: xOf(index), y: mainY, kind: "stop" });
    }
  }
  stops.push({ x: xOf(0), y: mainY, kind: focus === 0 ? "focus" : "terminus" });
  stops.push({ x: xOf(last), y: mainY, kind: focus === last ? "focus" : "terminus" });
  if (hasFocusLabel) stops.push({ x: xOf(focus), y: mainY, kind: "focus" });

  const paths: string[] = [];
  let lowest = 0;
  branches.forEach((branch, index) => {
    const lane = laneOf[index]!;
    const y = mainY + lane * LANE;
    const slope = lane * LANE;
    lowest = Math.max(lowest, lane);

    if (branch.type === "end") {
      const anchorX = xOf(branch.anchor);
      const direction = branch.side === "left" ? -1 : 1;
      const bendX = anchorX + direction * slope;
      const endX = branch.side === "left" ? Math.min(left, bendX) : Math.max(right, bendX);
      paths.push(`M${anchorX} ${mainY}L${bendX} ${y}L${endX} ${y}`);
      stops.push({ x: endX, y, kind: "branch" });
      labels.push({
        text: branch.label,
        x: branch.side === "left" ? endX - SMALL_DOT : endX + SMALL_DOT,
        y: y + SMALL_DOT + LABEL_GAP,
        align: branch.side,
        maxWidth: half,
        isStrong: false,
      });
      return;
    }

    const fromX = xOf(branch.from);
    const toX = xOf(branch.to);
    // Steeper than 45° when the two stops are too close for the slopes to fit.
    const run = Math.min(slope, (toX - fromX) / 2);
    paths.push(`M${fromX} ${mainY}L${fromX + run} ${y}L${toX - run} ${y}L${toX} ${mainY}`);
    const middle = (fromX + toX) / 2;
    stops.push({ x: middle, y, kind: "branch" });
    if (branch.label) {
      const labelWidth = Math.min(textWidth(branch.label), width);
      labels.push({
        text: branch.label,
        x: Math.min(Math.max(middle, labelWidth / 2), width - labelWidth / 2),
        y: y + SMALL_DOT + LABEL_GAP,
        align: "center",
        maxWidth: width,
        isStrong: false,
      });
    }
  });

  return {
    width,
    // The other routes' names go under their ends, clear of the slopes that lead there.
    height: lowest
      ? mainY + lowest * LANE + SMALL_DOT + LABEL_GAP + LABEL_HEIGHT + 2
      : mainY + BIG_DOT + 2,
    main: { type: "line", from: [left, mainY], to: [right, mainY] },
    branches: paths,
    stops,
    labels,
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
      stops.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle), kind: "stop" });
    }
  }
  quarters.forEach((index, quarter) => {
    const place = places[quarter]!;
    const isFocus = quarter === 0 && focus >= 0;
    stops.push({ x: place.x, y: place.y, kind: isFocus ? "focus" : "named" });
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
    main: { type: "loop", cx, cy, rx, ry },
    branches: [],
    stops,
    labels,
  };
}
