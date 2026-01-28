import { Skeleton } from "@repo/ui/components/skeleton";

export default function StationLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Map placeholder */}
      <Skeleton className="h-48 md:h-64 w-full rounded-none" />

      {/* Main content */}
      <div className="container mx-auto px-4 py-6 space-y-8 max-w-6xl">
        {/* Header skeleton */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-32 mt-2" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        </div>

        {/* Stats and nearby stations row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stats skeleton */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-44" />
            </div>
          </div>

          {/* Nearby stations skeleton */}
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Train board skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, columnIndex) => (
            <div
              key={columnIndex}
              className="ring-1 ring-foreground/10 rounded-xl p-4 space-y-4"
            >
              <div>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-20 mt-1" />
              </div>
              <div className="space-y-0">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex gap-3 py-3 border-b border-border last:border-b-0"
                  >
                    <Skeleton className="shrink-0 w-12 h-12 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between">
                        <Skeleton className="h-5 w-24" />
                        <Skeleton className="h-5 w-12" />
                      </div>
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
