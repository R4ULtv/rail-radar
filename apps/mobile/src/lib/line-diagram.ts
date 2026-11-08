// The schematic at the top of the line sheet: the chosen route as a straight line in the line's
// color, named at its ends below it, and where the other routes leave it in gray above, spaced
// to show how it branches rather than where its stops are. Only the shape is laid out here, in
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
   * (not drawn, but tappable), a named stop on a loop, the end of another route, or the middle of
   * a stretch some trains take instead (not drawn either).
   */
  kind: "terminus" | "destination" | "focus" | "stop" | "named" | "branch" | "bypass";
}

export interface LineDiagram {
  width: number;
  height: number;
  /**
   * How far down the line itself is drawn, with paths drawn around y 0 moved down by it. Termini
   * that other routes fork off near drop below it.
   */
  shift: number;
  /** The chosen route as an SVG path, or an ellipse for a loop. */
  main: { type: "path"; d: string } | LoopShape;
  /** SVG paths of the other routes, under the main line, drawn around y 0 like it. */
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

type Branch = BranchTarget &
  (
    | { type: "end"; anchor: number; side: "left" | "right"; label: string }
    | { type: "bypass"; from: number; to: number; label: string }
  );

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
        branch = {
          type: "end",
          anchor: after,
          side: forward ? "left" : "right",
          label,
          stationId: route.stations[0]!,
          routeIndex,
          stopIndex: 0,
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

  // The diagram shows how the line branches, not how far apart its stops are: the stops where
  // other routes leave it split it into stretches of equal width, and the stops along each are
  // spread evenly over it. Where branches leave from stops too close together for their slopes to
  // fit that way, the stretches are sized more and more by their stops instead.
  const keys = [
    ...new Set([
      0,
      last,
      ...branches.flatMap((branch) =>
        branch.type === "end" ? [branch.anchor] : [branch.from, branch.to],
      ),
    ]),
  ].sort((a, b) => a - b);
  const layouts = [1, 0.5, 0].map((evenness) => {
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
        const slope = laneOf[index]! * LANE;
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
      const bend = xOf(branch.anchor) + (branch.side === "left" ? -1 : 1) * laneOf[index]! * LANE;
      return bend >= EDGE - 0.5 && bend <= width - EDGE + 0.5;
    });
    return { laneOf, left, right, xOf, fits };
  });
  const { laneOf, left, right, xOf } = layouts.find((layout) => layout.fits) ?? layouts.at(-1)!;

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

  const firstName = input.nameOf(main[0]!);
  const lastName = input.nameOf(main[last]!);
  const half = width / 2 - LABEL_GAP;
  const destination = input.reversed ? 0 : last;
  const stops: DiagramStop[] = [];
  const labels: DiagramLabel[] = [];
  const target = (index: number) => ({
    stationId: main[index]!,
    routeIndex: input.selected,
    stopIndex: index,
  });

  // The other stops aren't drawn, but each can be tapped where it would be, if it isn't crowded.
  for (let index = 1; index < last; index++) {
    const x = xOf(index);
    const room = Math.min(x - xOf(index - 1), xOf(index + 1) - x);
    if (index !== focus && room >= MIN_STOP_SPACING) {
      stops.push({ ...target(index), x, y: along(x).y, kind: "stop" });
    }
  }
  const endKind = (index: number) =>
    focus === index ? "focus" : index === destination ? "destination" : "terminus";
  stops.push({ ...target(0), x: first[0], y: first[1], kind: endKind(0) });
  stops.push({ ...target(last), x: end[0], y: end[1], kind: endKind(last) });
  // The termini are named under their dots.
  const endLabel = (index: number, [x, y]: [number, number]) => ({
    x: index === 0 ? x - EDGE : x + EDGE,
    y: y + (focus === index ? FOCUS_DOT : BIG_DOT) + LABEL_GAP,
  });
  labels.push(
    { text: firstName, ...endLabel(0, first), align: "left", maxWidth: half, isStrong: true },
    { text: lastName, ...endLabel(last, end), align: "right", maxWidth: half, isStrong: true },
  );

  const paths: string[] = [];
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

  branches.forEach((branch, index) => {
    const lane = laneOf[index]!;
    const rise = lane * LANE;

    if (branch.type === "end") {
      const anchorX = xOf(branch.anchor);
      const direction = branch.side === "left" ? -1 : 1;
      const bendX = anchorX + direction * rise;
      const endX = branch.side === "left" ? Math.min(left, bendX) : Math.max(right, bendX);
      paths.push(`M${anchorX} 0L${bendX} ${-rise}L${endX} ${-rise}`);
      above.push(direction < 0 ? [anchorX - band, anchorX] : [anchorX, anchorX + band]);
      stops.push({ ...branch, x: endX, y: -rise, kind: "branch" });
      labels.push({
        text: branch.label,
        x: branch.side === "left" ? endX - EDGE : endX + EDGE,
        y: -rise - BRANCH_DOT - LABEL_GAP - LABEL_HEIGHT,
        align: branch.side,
        maxWidth: half,
        isStrong: false,
      });
      return;
    }

    // A stretch some trains take instead arcs over the line, with a dot at its top.
    const fromX = xOf(branch.from);
    const toX = xOf(branch.to);
    const pull = Math.min(rise * 0.7, (toX - fromX) / 3);
    paths.push(`M${fromX} 0C${fromX + pull} ${-rise} ${toX - pull} ${-rise} ${toX} 0`);
    const top = -rise * 0.75;
    if (-top - BRANCH_DOT < band) above.push([fromX, toX]);
    else above.push([fromX, fromX + pull], [toX - pull, toX]);
    const middle = (fromX + toX) / 2;
    stops.push({ ...branch, x: middle, y: top, kind: "bypass" });
    if (branch.label) {
      const labelWidth = Math.min(textWidth(branch.label), width);
      labels.push({
        text: branch.label,
        x: Math.min(Math.max(middle, labelWidth / 2), width - labelWidth / 2),
        y: top - BRANCH_DOT - LABEL_GAP - LABEL_HEIGHT,
        align: "center",
        maxWidth: width,
        isStrong: false,
      });
    }
  });

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
    const behind = destination === last ? 0 : 1;
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

  // An arrowhead just past the stop it was opened from, or midway along without one, when it fits.
  let chevron: LineDiagram["chevron"] = null;
  const sign = input.reversed ? -1 : 1;
  const chevronX = focus >= 0 ? xOf(focus) + sign * CHEVRON_OFFSET : (left + right) / 2;
  if (
    chevronX - CHEVRON_RADIUS - BIG_DOT >= first[0] &&
    chevronX + CHEVRON_RADIUS + BIG_DOT <= end[0]
  ) {
    const { y, angle } = along(chevronX);
    chevron = { x: chevronX, y, angle: input.reversed ? angle + 180 : angle };
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
    main: {
      type: "path",
      d: points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(""),
    },
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
