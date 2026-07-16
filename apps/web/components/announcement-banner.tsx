"use client";

import { useReducer, useRef, useSyncExternalStore } from "react";
import { ArrowRightIcon, HeartIcon, XIcon } from "lucide-react";
import { LazyMotion, domAnimation, m, AnimatePresence } from "motion/react";
import Link from "next/link";
import { Button, buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

const STORAGE_KEY = "banner-dismissed-v12";

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
              className="relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card/95 p-2.5 pr-10 shadow-lg shadow-black/8 backdrop-blur-md md:gap-3.5 md:p-3 md:pr-12 dark:shadow-black/25"
            >
              <div
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-accent text-accent-foreground shadow-xs md:size-11"
              >
                <HeartIcon className="size-4.5" fill="currentColor" strokeWidth={1.75} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold tracking-tight">
                    Rail Radar is growing fast
                  </p>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  <span className="md:hidden">Help one developer keep it free.</span>
                  <span className="hidden md:inline">
                    Built by one developer. Help cover the servers that keep it free.
                  </span>
                </p>
              </div>

              <Link
                href="/donate"
                onClick={dismiss}
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "hidden rounded-lg transition-transform duration-150 active:scale-[0.97] md:inline-flex",
                )}
              >
                Support
                <ArrowRightIcon data-icon="inline-end" />
              </Link>

              <Button
                variant="ghost"
                size="icon-xs"
                onClick={dismiss}
                aria-label="Dismiss announcement"
                className="absolute top-2 right-2 z-10 rounded-full text-muted-foreground hover:text-foreground md:top-2.5 md:right-2.5"
              >
                <XIcon className="size-3.5" />
              </Button>

              <Link
                href="/donate"
                onClick={dismiss}
                aria-label="Support Rail Radar"
                className="absolute inset-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:hidden"
              >
                <span className="sr-only">Support Rail Radar</span>
              </Link>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
