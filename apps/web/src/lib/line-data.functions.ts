import { createServerFn } from "@tanstack/react-start";
import {
  getLinePageData,
  getLinesDirectoryPageData,
  getOperatorLinesData,
} from "@/lib/line-data.server";

export const loadLinesDirectoryPage = createServerFn({ method: "GET" }).handler(() =>
  getLinesDirectoryPageData(),
);

export const loadLinePage = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => ({ id: data.id.trim() }))
  .handler(({ data }) => getLinePageData(data.id));

export const loadOperatorLines = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => ({ slug: data.slug.trim() }))
  .handler(({ data }) => getOperatorLinesData(data.slug));
