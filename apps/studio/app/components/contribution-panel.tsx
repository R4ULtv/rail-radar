"use client";

import { useMemo, useState } from "react";
import {
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  ExternalLinkIcon,
  CheckIcon,
  CopyIcon,
} from "lucide-react";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Separator } from "@repo/ui/components/separator";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { Label } from "@repo/ui/components/label";
import { toast } from "sonner";
import { useContribution } from "../contexts/contribution-context";
import { generatePRTitle, generatePRBody } from "../lib/pr-generator";
import type { StationChange } from "../types/contribution";
import { cn } from "@repo/ui/lib/utils";

interface ContributionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GITHUB_REPO_OWNER = "r4ultv";
const GITHUB_REPO_NAME = "rail-radar";

function formatChangeDetails(change: StationChange): string {
  const { type, details } = change;

  if (type === "created") {
    if (details.newGeo) {
      return `Created at (${details.newGeo.lat.toFixed(4)}, ${details.newGeo.lng.toFixed(4)})`;
    }
    return "Created";
  }

  if (type === "deleted") {
    return "Deleted";
  }

  const updates: string[] = [];
  if (details.coordinatesAdded && details.newGeo) {
    updates.push(
      `Added coordinates (${details.newGeo.lat.toFixed(4)}, ${details.newGeo.lng.toFixed(4)})`,
    );
  } else if (details.coordinatesUpdated && details.newGeo) {
    updates.push(
      `Moved to (${details.newGeo.lat.toFixed(4)}, ${details.newGeo.lng.toFixed(4)})`,
    );
  }
  if (details.nameChanged) {
    updates.push(`Renamed from "${details.previousName}"`);
  }

  return updates.join(", ");
}

function ChangeIcon({ type }: { type: StationChange["type"] }) {
  const iconClass = "size-4";
  switch (type) {
    case "created":
      return <PlusIcon className={cn(iconClass, "text-green-500")} />;
    case "updated":
      return <PencilIcon className={cn(iconClass, "text-blue-500")} />;
    case "deleted":
      return <Trash2Icon className={cn(iconClass, "text-red-500")} />;
  }
}

export function ContributionPanel({
  open,
  onOpenChange,
}: ContributionPanelProps) {
  const { changes, stats, clearSession, isSessionActive } = useContribution();
  const [titleCopied, setTitleCopied] = useState(false);
  const [bodyCopied, setBodyCopied] = useState(false);

  const title = useMemo(() => {
    if (!stats) return "";
    return generatePRTitle(stats);
  }, [stats]);

  const body = useMemo(() => {
    if (!stats) return "";
    return generatePRBody(changes, stats);
  }, [changes, stats]);

  const handleCopyTitle = async () => {
    try {
      await navigator.clipboard.writeText(title);
      setTitleCopied(true);
      toast.success("Title copied to clipboard");
      setTimeout(() => setTitleCopied(false), 2000);
    } catch {
      toast.error("Failed to copy title");
    }
  };

  const handleCopyBody = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setBodyCopied(true);
      toast.success("Body copied to clipboard");
      setTimeout(() => setBodyCopied(false), 2000);
    } catch {
      toast.error("Failed to copy body");
    }
  };

  const handleOpenInGitHub = () => {
    const params = new URLSearchParams({
      quick_pull: "1",
      title,
      body,
    });
    const url = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/compare/main...HEAD?${params.toString()}`;
    window.open(url, "_blank");
  };

  const handleClearSession = () => {
    clearSession();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Contribution Session</DialogTitle>
          <DialogDescription>Review your changes</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {stats && (
            <>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-muted-foreground">Changes</div>
                  <div className="text-2xl font-semibold">
                    {stats.changesCount}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Coverage</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-semibold">
                      {stats.currentCoverage.toFixed(1)}%
                    </span>
                    {stats.currentCoverage > stats.initialCoverage && (
                      <span className="text-xs text-green-500">
                        +
                        {(
                          stats.currentCoverage - stats.initialCoverage
                        ).toFixed(1)}
                        %
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-muted-foreground">Coords Added</div>
                  <div className="text-2xl font-semibold">
                    {stats.coordinatesAdded}
                  </div>
                </div>
              </div>

              <Separator />
            </>
          )}

          <ScrollArea className="max-h-48">
            {changes.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <MapPinIcon className="mx-auto mb-2 size-8 opacity-50" />
                <p>No changes yet</p>
                <p className="mt-1">
                  Start editing stations to track your contributions.
                </p>
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {changes.map((change) => (
                  <div
                    key={change.id}
                    className="flex items-start gap-3 rounded-md border border-border bg-card p-3"
                  >
                    <ChangeIcon type={change.type} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {change.stationName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatChangeDetails(change)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {isSessionActive && (
            <>
              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pr-title">PR Title</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyTitle}
                    className="h-7 gap-1.5 text-xs"
                  >
                    {titleCopied ? (
                      <>
                        <CheckIcon className="size-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <Input
                  id="pr-title"
                  value={title}
                  readOnly
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pr-body">PR Description</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyBody}
                    className="h-7 gap-1.5 text-xs"
                  >
                    {bodyCopied ? (
                      <>
                        <CheckIcon className="size-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-3" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  id="pr-body"
                  value={body}
                  readOnly
                  className="h-40 resize-none font-mono text-xs"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClearSession}>
            Clear Session
          </Button>
          <Button onClick={handleOpenInGitHub} disabled={!isSessionActive}>
            <ExternalLinkIcon className="size-4" />
            Open in GitHub
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
