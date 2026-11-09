import { useCallback, useLayoutEffect, useState } from "react";

/** Keep the closing frame intact, then release its rows after the sheet reaches -1. */
export function useSheetContent(isOpen: boolean) {
  const [closed, setClosed] = useState(!isOpen);
  useLayoutEffect(() => {
    // Also clear a late close callback after a quick reopen. The open prop always
    // keeps content rendered, even before this layout effect runs.
    if (isOpen && closed) setClosed(false);
  }, [isOpen, closed]);
  const onClosed = useCallback(() => setClosed(true), []);
  return { renderContent: isOpen || !closed, onClosed };
}
