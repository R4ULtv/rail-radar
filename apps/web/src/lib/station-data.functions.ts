import { createServerFn } from "@tanstack/react-start";
import {
  getCountryStationsPageData,
  getStationPageData,
  getStationsDirectoryPageData,
} from "@/lib/station-data.server";

export const loadStationPage = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => ({ id: data.id.trim() }))
  .handler(({ data }) => getStationPageData(data.id));

export const loadCountryStationsPage = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => ({ slug: data.slug.trim() }))
  .handler(({ data }) => getCountryStationsPageData(data.slug));

export const loadStationsDirectoryPage = createServerFn({ method: "GET" }).handler(() =>
  getStationsDirectoryPageData(),
);
