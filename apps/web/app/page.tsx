import { Suspense } from "react";

import { Map } from "@/components/map";
import MapLoading from "@/components/map-loading";

export default function Home() {
  return (
    <main className="h-svh w-svw">
      <Suspense fallback={<MapLoading />}>
        <Map />
      </Suspense>
    </main>
  );
}
