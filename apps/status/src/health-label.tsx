import type { ProviderHealth } from "@repo/data/status";
import { Badge } from "@repo/ui/components/badge";
import { STATUS_LABELS } from "./format";

export function HealthLabel({ status, label }: { status: ProviderHealth; label?: string }) {
  return (
    <Badge variant="outline" data-health={status}>
      <span className="status-dot" aria-hidden="true" />
      {label ?? STATUS_LABELS[status]}
    </Badge>
  );
}
