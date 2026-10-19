import { useEffect } from "react";
import { env } from "@/lib/env";

export function Analytics() {
  useEffect(() => {
    if (!env.posthogKey) return;
    void import("@/lib/posthog").then(({ initPostHog }) => initPostHog());
  }, []);

  return null;
}
