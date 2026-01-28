import { Skeleton } from "@repo/ui/components/skeleton";

export default function StationLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Map hero placeholder */}
      <div className="relative h-48 md:h-64 w-full">
        <Skeleton className="absolute inset-0 rounded-none" />
        {/* Back button placeholder */}
        <div className="absolute top-2 left-2 md:top-4 md:left-4">
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto px-4 py-6 space-y-8 max-w-7xl">
        {/* Station header skeleton */}
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-40 mt-2" />
            </div>
            <div className="flex gap-2 shrink-0">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
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
      </div>

      {/* Train board skeleton - edge-to-edge on mobile, centered on desktop */}
      <div className="md:mx-auto md:px-4 md:pb-6 max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, columnIndex) => (
            <div
              key={columnIndex}
              className="flex flex-col h-full pt-4 pb-0 md:py-4 gap-4 rounded-none ring-0 shadow-none md:rounded-xl md:ring-1 md:shadow-xs"
            >
              <div className="px-4 space-y-1">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex-1 px-0 overflow-hidden">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex gap-3 px-4 py-3 border-b border-border last:border-b-0"
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
