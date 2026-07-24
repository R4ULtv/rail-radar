"use client";

import { useReducer, useRef, useSyncExternalStore } from "react";
import { ArrowRightIcon, TrendingUpIcon, XIcon } from "lucide-react";
import { LazyMotion, domAnimation, m, AnimatePresence } from "motion/react";
import Link from "next/link";
import { Button, buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

const STORAGE_KEY = "banner-dismissed-report-2026-07-24";

const subscribe = () => () => {};
const getSnapshot = () => !localStorage.getItem(STORAGE_KEY);
const getServerSnapshot = () => false;

export function AnnouncementBanner() {
  const shouldShow = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const dismissedRef = useRef(false);
  const [, rerender] = useReducer((value: number) => value + 1, 0);

  const visible = shouldShow && !dismissedRef.current;

  const dismiss = () => {
    dismissedRef.current = true;
    localStorage.setItem(STORAGE_KEY, "1");
    rerender();
  };

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {visible && (
          <m.div
            initial={{ opacity: 0, y: -12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute z-40 top-[calc(--spacing(4)+(--spacing(10))+(--spacing(2)))] left-4 right-4 md:top-4 md:left-[calc(--spacing(4)+20rem+(--spacing(3)))] md:right-auto"
          >
            <div
              role="status"
              className="relative flex items-center gap-3 overflow-hidden p-2.5 pr-10 md:gap-3.5 md:p-3 md:pr-12 bg-card border border-input text-card-foreground rounded-md shadow-xs"
            >
              <div
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-accent text-accent-foreground shadow-xs md:size-11"
              >
                <TrendingUpIcon className="size-4.5" strokeWidth={1.75} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold tracking-tight">
                    New: July traffic report
                  </p>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  <span className="md:hidden">See how Rail Radar grew.</span>
                  <span className="hidden md:inline">
                    ~70k visits across 13 countries, and Germany takes the lead.
                  </span>
                </p>
              </div>

              <Link
                href="/report/2026-07-24"
                onClick={dismiss}
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "hidden transition-transform duration-150 active:scale-[0.97] md:inline-flex",
                )}
              >
                Read report
                <ArrowRightIcon data-icon="inline-end" />
              </Link>

              <Button
                variant="ghost"
                size="icon-xs"
                onClick={dismiss}
                aria-label="Dismiss announcement"
                className="absolute top-2 right-2 z-10 text-muted-foreground hover:text-foreground md:top-2.5 md:right-2.5"
              >
                <XIcon className="size-3.5" />
              </Button>

              <Link
                href="/report/2026-07-24"
                onClick={dismiss}
                aria-label="Read the July 2026 Rail Radar traffic report"
                className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:hidden"
              >
                <span className="sr-only">Read the July 2026 Rail Radar traffic report</span>
              </Link>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
