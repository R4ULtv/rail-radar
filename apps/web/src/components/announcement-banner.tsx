"use client";

import { useReducer, useRef, useSyncExternalStore } from "react";
import { ContainerIcon, XIcon } from "lucide-react";
import { LazyMotion, domAnimation, m, AnimatePresence } from "motion/react";
import { Button } from "@repo/ui/components/button";

const STORAGE_KEY = "banner-dismissed-v18";

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
              className="relative flex items-center gap-3 overflow-hidden rounded-3xl bg-card p-2.5 pr-10 text-card-foreground shadow-md ring-1 ring-foreground/5 md:gap-3.5 md:p-3 md:pr-12 dark:ring-foreground/10"
            >
              <div
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand/15 text-brand md:size-11"
              >
                <ContainerIcon className="size-5 md:size-6" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex items-center gap-1.5">
                  <p className="truncate text-sm font-semibold tracking-tight">
                    New: freight stations
                  </p>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  Discover yards, terminals, and ports
                </p>
              </div>

              <Button
                variant="ghost"
                size="icon-xs"
                onClick={dismiss}
                aria-label="Dismiss announcement"
                className="absolute top-2 right-2 z-10 text-muted-foreground hover:text-foreground md:top-2.5 md:right-2.5"
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
