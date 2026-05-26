import { AlertTriangleIcon } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

export function PolishStationWarning({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md max-w-fit bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200",
        className,
      )}
    >
      <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
      <p>
        Live data for stations in Poland may be unstable or incomplete right now. We are working to
        improve it.
      </p>
    </div>
  );
}
