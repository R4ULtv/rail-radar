import { Button } from "@repo/ui/components/button";

type TrainBoardNoticeProps = {
  hasSnapshot: boolean;
  isValidating: boolean;
  onRetry: () => void;
};

export function TrainBoardNotice({ hasSnapshot, isValidating, onRetry }: TrainBoardNoticeProps) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
      <p className="text-muted-foreground" role="status">
        {hasSnapshot
          ? "Live updates are unavailable. Showing the last received data."
          : "Unable to load live trains. Please try again."}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        disabled={isValidating}
        aria-label={hasSnapshot ? "Retry live updates" : "Retry loading live trains"}
      >
        {isValidating ? "Retrying…" : "Retry"}
      </Button>
    </div>
  );
}
