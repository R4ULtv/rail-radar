import vtStationsData from "./vt-stations.json" with { type: "json" };
import type { VTStation } from "./vt-types";

/** ViaggiaTreno station data with coordinates */
export const vtStations: VTStation[] = vtStationsData;
