import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, XIcon } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { useDeviceCheck } from "@/hooks/use-device-check";
import { PlatformLogo, type AppPlatform } from "@/components/platform-logo";

const tickets: Record<
  AppPlatform | "other",
  { platforms: AppPlatform[]; title: string; description: string; action: string }
> = {
  android: {
    platforms: ["android"],
    title: "Faster in the app",
    description: "One tap from your home screen.",
    action: "Join the free beta",
  },
  ios: {
    platforms: ["ios"],
    title: "Faster in the app",
    description: "iPhone version coming soon.",
    action: "Join the waitlist",
  },
  other: {
    platforms: ["android", "ios"],
    title: "Faster on your phone",
    description: "Free Android beta, iPhone soon.",
    action: "Get the app",
  },
};

const DISMISSED_KEY = "app-ticket-dismissed:v1";

/**
 * Hides every app ticket before first paint once a visitor has dismissed one, so prerendered
 * pages don't shift. Runs inline in the document head.
 */
export const appTicketDismissedScript = `try{if(localStorage.getItem("${DISMISSED_KEY}"))document.documentElement.dataset.appTicketDismissed=""}catch(e){}`;

function dismissAppTickets() {
  // The attribute hides tickets through styles.css, wherever they are on the page.
  document.documentElement.dataset.appTicketDismissed = "";
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // The tickets stay hidden until the next page load.
  }
}

/**
 * A link to the mobile app page, drawn as a ticket like the footer's directory links. `stacked`
 * tears off at the bottom; `compact` tears off at the side, for narrow lists. Visitors can dismiss
 * it for good, which hides every ticket.
 */
export function AppTicket({
  layout = "stacked",
  className,
}: {
  layout?: "stacked" | "compact";
  className?: string;
}) {
  const { platform } = useDeviceCheck();
  // Before detection (and in prerendered HTML) the ticket offers both apps.
  const ticket = tickets[platform === "checking" ? "other" : platform];
  const stacked = layout === "stacked";

  return (
    <div
      data-app-ticket=""
      className={cn(
        "footer-ticket-link relative min-w-0 rounded-2xl [--ticket-angle:0deg]",
        className,
      )}
    >
      {/* The link covers the whole ticket; the ticket itself ignores the pointer so it can lift
          on hover without slipping out from under it. */}
      <Link
        to="/app"
        aria-label={`${ticket.title}. ${ticket.description} ${ticket.action}`}
        className="absolute inset-0 rounded-2xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
      />
      <div
        className={cn(
          "footer-ticket pointer-events-none relative rounded-2xl bg-brand text-brand-foreground [--platform-logo-cutout:var(--color-brand)]",
          stacked
            ? "app-ticket-stacked flex flex-col gap-3 px-5 py-4"
            : "app-ticket-compact grid grid-cols-[minmax(0,1fr)_2rem] gap-x-4 gap-y-1.5 px-4 py-3",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <span
            aria-hidden="true"
            className={cn(
              "flex items-center gap-2.5 font-mono tracking-[0.06em]",
              stacked ? "text-xs" : "text-[10px]",
            )}
          >
            {/* Trimmed to the capitals, so the logos center on the letters, not the line box. */}
            <span className="leading-none [text-box:trim-both_cap_alphabetic]">RAIL RADAR</span>
            {ticket.platforms.map((logo) => (
              <PlatformLogo
                key={logo}
                platform={logo}
                mono
                className={logo === "android" ? "size-4.5" : "size-3.5"}
              />
            ))}
          </span>
          <button
            type="button"
            data-ticket-dismiss=""
            aria-label="Don't show the mobile app ticket again"
            title="Don't show again"
            onClick={dismissAppTickets}
            className="pointer-events-auto relative -my-[3px] -mr-1.5 flex size-6 shrink-0 items-center justify-center rounded-full text-brand-foreground/75 transition-colors after:absolute after:-inset-2.5 after:content-[''] hover:bg-brand-foreground/15 hover:text-brand-foreground focus-visible:outline-2 focus-visible:outline-brand-foreground"
          >
            <XIcon aria-hidden="true" className="size-3.5" />
          </button>
        </div>

        <span className="flex flex-col">
          <span
            className={cn(
              "font-[650] tracking-[-0.035em]",
              stacked ? "text-2xl leading-8" : "text-xl leading-7",
            )}
          >
            {ticket.title}
          </span>
          <span className="text-sm leading-5 text-pretty">{ticket.description}</span>
        </span>

        {/* The stub, torn off along the dashed line between the notches (see styles.css). */}
        <span
          aria-hidden="true"
          className={cn(
            "flex items-center border-dashed border-current/40",
            stacked
              ? "mt-auto justify-between border-t pt-2.5"
              : "col-start-2 row-span-2 row-start-1 justify-end border-l",
          )}
        >
          {stacked && (
            <span className="font-mono text-xs leading-[18px] tracking-[0.03em] uppercase">
              {ticket.action}
            </span>
          )}
          <ArrowRightIcon className="size-4" />
        </span>
      </div>
    </div>
  );
}
