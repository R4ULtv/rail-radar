import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@repo/ui/components/empty";
import { WifiOffIcon } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WifiOffIcon />
          </EmptyMedia>
        </EmptyHeader>
        <EmptyContent>
          <EmptyTitle>You&apos;re offline</EmptyTitle>
          <EmptyDescription>
            Rail Radar needs an internet connection to show live train data.
            Please check your connection and try again.
          </EmptyDescription>
        </EmptyContent>
      </Empty>
    </div>
  );
}
