import { cn } from "@repo/ui/lib/utils";
import { useDeviceCheck } from "@/hooks/use-device-check";
import { AppTicket } from "@/components/app-ticket";

/** The mobile app ticket, placed among the station page's sections. */
export function AppPromo({ className }: { className?: string }) {
  const { platform } = useDeviceCheck();

  // The prerendered page shows the desktop ticket, so it doesn't push the board down after
  // hydration. Phones keep its space hidden until their own ticket is ready.
  return (
    <AppTicket
      layout="stacked"
      className={cn(platform === "checking" && "max-md:invisible", className)}
    />
  );
}
