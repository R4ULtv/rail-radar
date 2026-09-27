"use client";

import { useReducer, useRef, useSyncExternalStore } from "react";
import { ArrowRightIcon, XIcon } from "lucide-react";
import { LazyMotion, domAnimation, m, AnimatePresence } from "motion/react";
import { Link } from "@tanstack/react-router";
import { Button, buttonVariants } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { useDeviceCheck } from "@/hooks/use-device-check";
import { prerenderedPageLinkProps } from "@/lib/station-prerender";

const STORAGE_KEY = "banner-dismissed-v16";

const subscribe = () => () => {};
const getSnapshot = () => !localStorage.getItem(STORAGE_KEY);
const getServerSnapshot = () => false;

export function AnnouncementBanner() {
  const shouldShow = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // The beta is on Google Play only, so the banner is for Android visitors.
  const { platform } = useDeviceCheck();
  const dismissedRef = useRef(false);
  const [, rerender] = useReducer((value: number) => value + 1, 0);

  const visible = shouldShow && platform === "android" && !dismissedRef.current;

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
              className="relative flex items-center gap-3 overflow-hidden rounded-3xl bg-card p-2.5 pr-10 text-card-foreground shadow-md ring-1 ring-foreground/5 md:gap-3.5 md:p-3 md:pr-12 dark:ring-foreground/10"
            >
              <img
                aria-hidden="true"
                src="/icon.svg"
                alt=""
                className="size-10 shrink-0 rounded-2xl md:size-11"
              />

              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold tracking-tight">
                    Rail Radar for Android
                  </p>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  Join the closed beta on Google Play.
                </p>
              </div>

              <Link
                to="/app"
                {...prerenderedPageLinkProps}
                onClick={dismiss}
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "hidden transition-transform duration-150 active:scale-[0.97] md:inline-flex",
                )}
              >
                Join the beta
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
                to="/app"
                {...prerenderedPageLinkProps}
                onClick={dismiss}
                aria-label="Join the Rail Radar Android beta"
                className="absolute inset-0 rounded-3xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-inset md:hidden"
              >
                <span className="sr-only">Join the Rail Radar Android beta</span>
              </Link>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
