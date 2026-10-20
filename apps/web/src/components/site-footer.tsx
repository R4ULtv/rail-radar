import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { prerenderedPageLinkProps } from "@/lib/station-prerender";

const focusClassName =
  "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";
const utilityLinkClassName = `${focusClassName} inline-flex min-h-10 items-center text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground`;
const directories = [
  {
    to: "/operators",
    label: "Operators",
    description: "Who runs the trains",
    className: "[--ticket-angle:-1deg] md:[--ticket-angle:-3deg]",
    reloadDocument: false,
  },
  {
    to: "/stations",
    label: "Stations",
    description: "Find your next stop",
    className: "[--ticket-angle:1deg] md:[--ticket-angle:-1deg]",
    reloadDocument: prerenderedPageLinkProps.reloadDocument,
  },
  {
    to: "/lines",
    label: "Lines",
    description: "Trace the network",
    className: "[--ticket-angle:-1deg] md:[--ticket-angle:-4deg]",
    reloadDocument: prerenderedPageLinkProps.reloadDocument,
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 pb-7 pt-10 md:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className={`${focusClassName} inline-flex items-center gap-3`}>
            <img src="/icon@64px.png" alt="" width={30} height={30} className="size-7.5" />
            <span className="text-base font-semibold tracking-tight">Rail Radar</span>
          </Link>
          <p className="font-mono text-[10px] tracking-[0.06em] text-muted-foreground sm:text-xs">
            NO TICKET REQUIRED.
          </p>
        </div>

        <nav
          aria-label="Rail directories"
          className="grid gap-5 px-2 py-3 md:grid-cols-3 md:px-1 md:pb-4"
        >
          {directories.map(({ to, label, description, className, reloadDocument }) => (
            <Link
              key={to}
              to={to}
              reloadDocument={reloadDocument}
              aria-label={`Browse ${label.toLowerCase()}`}
              className={cn(
                "footer-ticket-link relative block min-w-0 rounded-[12px] outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring",
                className,
              )}
            >
              <span
                className={cn(
                  "footer-ticket pointer-events-none relative grid grid-cols-[minmax(0,1fr)_2rem] gap-x-4 gap-y-2 rounded-[12px] p-4 md:flex md:h-full md:flex-col md:gap-5 md:px-6 md:py-5",
                  to === "/stations"
                    ? "bg-brand text-brand-foreground"
                    : "bg-primary text-primary-foreground",
                )}
              >
                <span
                  aria-hidden="true"
                  className="flex items-center justify-between font-mono text-[10px] leading-[18px] tracking-[0.06em] md:text-xs"
                >
                  RAIL RADAR
                  <ArrowUpRightIcon className="hidden size-3.5 md:block" />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-2xl font-[650] leading-8 tracking-[-0.035em] md:text-3xl md:leading-9">
                    {label}
                  </span>
                  <span className="text-sm leading-5">{description}</span>
                </span>
                <span
                  aria-hidden="true"
                  className="relative col-start-2 row-span-2 row-start-1 flex items-center justify-end border-l border-dashed border-current/40 md:mt-auto md:justify-between md:border-l-0 md:border-t md:pt-3"
                >
                  <span className="pointer-events-none absolute -top-6 -left-2 size-4 rounded-full bg-background md:-top-2 md:-left-8" />
                  <span className="pointer-events-none absolute -bottom-6 -left-2 size-4 rounded-full bg-background md:top-[-8px] md:-right-8 md:bottom-auto md:left-auto" />
                  <span className="hidden font-mono text-xs leading-[18px] tracking-[0.03em] md:block">
                    VIEW DIRECTORY
                  </span>
                  <ArrowRightIcon className="size-4" />
                </span>
              </span>
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="text-xs text-muted-foreground">
            Made by{" "}
            <a
              href="https://www.raulcarini.dev"
              className={`${focusClassName} inline-flex min-h-10 items-center underline decoration-border underline-offset-4 transition-colors duration-150 hover:text-foreground hover:decoration-current`}
            >
              Raul Carini
            </a>
          </p>
          <nav aria-label="More links" className="flex flex-wrap gap-x-5">
            <Link to="/" className={utilityLinkClassName}>
              Live map
            </Link>
            <Link to="/app" className={utilityLinkClassName}>
              App
            </Link>
            <Link to="/donate" className={utilityLinkClassName}>
              Donate
            </Link>
            <a href="mailto:contact@railradar24.com" className={utilityLinkClassName}>
              Contact
            </a>
            <Link to="/privacy-policy" className={utilityLinkClassName}>
              Privacy
            </Link>
            <Link to="/terms-of-service" className={utilityLinkClassName}>
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
