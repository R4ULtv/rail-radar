import Link from "next/link";
import { Button } from "@repo/ui/components/button";
import { MapIcon, SearchIcon } from "lucide-react";

export default function StationNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Station Not Found</h1>
          <p className="text-muted-foreground">
            We couldn&apos;t find a station with that ID. It may have been
            removed or the link might be incorrect.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button nativeButton={false} render={<Link href="/" />}>
            <MapIcon className="size-4" />
            Back to Map
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/?search=true" />}
          >
            <SearchIcon className="size-4" />
            Search Stations
          </Button>
        </div>
      </div>
    </div>
  );
}
