import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

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

      {/* Train board skeleton - matches the real TrainBoard component */}
      <div className="md:mx-auto md:px-4 md:pb-6 max-w-7xl">
        {/* Mobile: show tabs placeholder + single column */}
        <div className="md:hidden flex flex-col gap-4">
          <div className="px-4">
            <Skeleton className="h-10 w-full" />
          </div>
          <Card className="flex flex-col h-[500px] pt-4 pb-0 gap-4 rounded-none ring-0 shadow-none">
            <CardHeader className="px-4">
              <CardTitle className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-5 w-24" />
              </CardTitle>
              <CardDescription>
                <Skeleton className="h-4 w-32" />
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 px-0 overflow-auto">
              <div>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3 border-b"
                  >
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Desktop: two columns side by side */}
        <div className="hidden md:grid grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, columnIndex) => (
            <Card
              key={columnIndex}
              className="flex flex-col h-[500px] py-4 gap-4 rounded-xl ring-1 shadow-xs"
            >
              <CardHeader className="px-4">
                <CardTitle className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-5 w-24" />
                </CardTitle>
                <CardDescription>
                  <Skeleton className="h-4 w-32" />
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 px-0 overflow-auto">
                <div>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-4 py-3 border-b"
                    >
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
