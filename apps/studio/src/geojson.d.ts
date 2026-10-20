declare module "*.geojson" {
  import type { StationFeatureCollection } from "@repo/data";
  const data: StationFeatureCollection;
  export default data;
}
