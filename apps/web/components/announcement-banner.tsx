"use client";

import { useState, useEffect } from "react";
import { SparklesIcon, XIcon } from "lucide-react";
import { LazyMotion, domAnimation, m, AnimatePresence } from "motion/react";
import { Alert, AlertTitle, AlertAction } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";

const STORAGE_KEY = "banner-dismissed-v1";

export function AnnouncementBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "1");
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
            <Alert className="flex-row items-center gap-2 rounded-md py-2 px-3 shadow-xs md:h-9 has-data-[slot=alert-action]:pr-12">
              <AlertTitle className="truncate text-[13px] font-normal flex items-center">
                <Badge
                  variant="default"
                  className="text-[10px] uppercase tracking-wide mr-1.5 align-middle"
                >
                  <SparklesIcon data-icon="inline-start" />
                  <span className="hidden md:block">New</span>
                </Badge>
                <span className="hidden md:inline">
                  ~2000 stations added ⋅ 🇧🇪 Belgium, 🇳🇱 Netherlands &amp; 🇫🇮 Finland now live!
                </span>
                <span className="md:hidden">🇧🇪 🇳🇱 🇫🇮 3 new countries &amp; ~2000 stations!</span>
              </AlertTitle>
              <AlertAction className="top-1.5">
                <Button variant="ghost" size="icon-xs" onClick={dismiss} aria-label="Dismiss">
                  <XIcon className="size-3.5" />
                </Button>
              </AlertAction>
            </Alert>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
}
