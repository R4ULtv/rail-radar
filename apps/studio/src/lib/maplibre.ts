import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// Vite must bundle the ESM worker together with its shared module.
setWorkerUrl(workerUrl);

export * from "maplibre-gl";
