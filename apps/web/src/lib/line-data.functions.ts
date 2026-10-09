import { createServerFn } from "@tanstack/react-start";
import { getLinePageData, getLinesDirectoryPageData } from "@/lib/line-data.server";

export const loadLinesDirectoryPage = createServerFn({ method: "GET" }).handler(() =>
  getLinesDirectoryPageData(),
);

export const loadLinePage = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => ({ id: data.id.trim() }))
  .handler(({ data }) => getLinePageData(data.id));
