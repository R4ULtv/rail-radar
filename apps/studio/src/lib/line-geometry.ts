import type { LineGeometry } from "@repo/data";

// Each line's track is its own file, loaded only when the browser workspace needs it.
const files = import.meta.glob<LineGeometry>("../../../../packages/data/src/lines/*.json", {
  import: "default",
});

/** Bundled track for the given lines; lines without a file have no track yet. */
export async function loadBundledGeometries(ids: string[]): Promise<Map<string, LineGeometry>> {
  const loaded = await Promise.all(
    ids.map(async (id) => {
      const load = files[`../../../../packages/data/src/lines/${id}.json`];
      return [id, load ? await load() : null] as const;
    }),
  );
  return new Map(loaded.filter((entry): entry is [string, LineGeometry] => entry[1] !== null));
}

export const emptyGeometry = (): LineGeometry => ({ type: "MultiLineString", coordinates: [] });
