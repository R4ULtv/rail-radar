/** [west, south, east, north] in degrees. */
export type Bounds = [number, number, number, number];

/** Mapbox draws 512px tiles: the whole world is 512 × 2^zoom pixels wide. */
const TILE_SIZE = 512;

function mercatorX(lng: number): number {
  return (lng + 180) / 360;
}

function mercatorY(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
}

/**
 * Projects coordinates onto a `width` × `height` image of `bounds`, fitted the way the
 * Mapbox Static Images API fits a bbox with `padding`, so drawings line up with the
 * image the API returns for the same request.
 */
export function createBoundsProjection(
  bounds: Bounds,
  width: number,
  height: number,
  padding: number,
) {
  const [west, south, east, north] = bounds;
  const x0 = mercatorX(west);
  const x1 = mercatorX(east);
  const y0 = mercatorY(north);
  const y1 = mercatorY(south);
  const scale = Math.min(
    (width - padding * 2) / ((x1 - x0) * TILE_SIZE),
    (height - padding * 2) / ((y1 - y0) * TILE_SIZE),
  );
  const worldSize = TILE_SIZE * scale;
  const centerX = (x0 + x1) / 2;
  const centerY = (y0 + y1) / 2;

  return {
    zoom: Math.log2(scale),
    project: ([lng, lat]: readonly number[]): [number, number] => [
      width / 2 + (mercatorX(lng!) - centerX) * worldSize,
      height / 2 + (mercatorY(lat!) - centerY) * worldSize,
    ],
    /** The [lng, lat] under a pixel of the image. */
    unproject: ([x, y]: readonly number[]): [number, number] => {
      const mx = centerX + (x! - width / 2) / worldSize;
      const my = centerY + (y! - height / 2) / worldSize;
      return [mx * 360 - 180, (Math.atan(Math.sinh(Math.PI * (1 - 2 * my))) * 180) / Math.PI];
    },
  };
}

function distanceToSegment(p: number[], a: number[], b: number[]): number {
  const dx = b[0]! - a[0]!;
  const dy = b[1]! - a[1]!;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((p[0]! - a[0]!) * dx + (p[1]! - a[1]!) * dy) / lengthSquared))
    : 0;
  return Math.hypot(p[0]! - (a[0]! + t * dx), p[1]! - (a[1]! + t * dy));
}

/** Douglas–Peucker: drops points that move the drawn line by less than `tolerance` px. */
export function simplify<T extends number[]>(points: T[], tolerance: number): T[] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let farthest = -1;
    let maxDistance = tolerance;
    for (let i = start + 1; i < end; i++) {
      const distance = distanceToSegment(points[i]!, points[start]!, points[end]!);
      if (distance > maxDistance) {
        maxDistance = distance;
        farthest = i;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = 1;
      stack.push([start, farthest], [farthest, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
