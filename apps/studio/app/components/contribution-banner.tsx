"use client";

import { Button } from "@repo/ui/components/button";
import { useContribution } from "../contexts/contribution-context";

interface ContributionBannerProps {
  onReviewClick: () => void;
}

export function ContributionBanner({ onReviewClick }: ContributionBannerProps) {
  const { changes, isSessionActive } = useContribution();

  if (!isSessionActive) {
    return null;
  }

  const changesCount = changes.length;

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="size-2 rounded-full bg-green-500" />
        <span>
          {changesCount} change{changesCount !== 1 ? "s" : ""} pending
        </span>
      </div>
      <Button variant="outline" size="sm" onClick={onReviewClick}>
        Review
      </Button>
    </div>
  );
}
