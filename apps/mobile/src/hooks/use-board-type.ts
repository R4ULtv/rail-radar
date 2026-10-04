import { useCallback, useState } from "react";

import type { BoardType } from "@/hooks/use-station-board";

/** Enter Nearby on departures without remounting the board or losing its saved tabs. */
export function useBoardType(isNearby: boolean) {
  const [selection, setSelection] = useState<{ type: BoardType; isNearby: boolean }>({
    type: "departures",
    isNearby,
  });
  const type = isNearby && !selection.isNearby ? "departures" : selection.type;
  if (isNearby !== selection.isNearby) setSelection({ type, isNearby });

  const setType = useCallback(
    (next: BoardType) => setSelection({ type: next, isNearby }),
    [isNearby],
  );
  return [type, setType] as const;
}
