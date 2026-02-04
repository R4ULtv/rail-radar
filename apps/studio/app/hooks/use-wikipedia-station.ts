import useSWR from "swr";
import type {
  WikipediaSearchResponse,
  WikipediaContentResponse,
  StationInfobox,
} from "../types/wikipedia";
import { parseStationInfobox } from "../lib/wikipedia-parser";

const WIKIPEDIA_API = "https://it.wikipedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

interface UseWikipediaStationResult {
  data: StationInfobox | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetch Wikipedia station info for a given station name
 */
export function useWikipediaStation(
  stationName: string | null,
): UseWikipediaStationResult {
  const { data, error, isLoading } = useSWR(
    stationName ? `wikipedia:${stationName}` : null,
    () => fetchWikipediaStation(stationName!),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
    },
  );

  return {
    data: data ?? null,
    isLoading,
    error: error ?? null,
  };
}

/**
 * Search for and fetch Wikipedia station article
 */
async function fetchWikipediaStation(
  stationName: string,
): Promise<StationInfobox | null> {
  // Search for the station article
  const searchResult = await searchWikipedia(stationName);
  if (!searchResult) {
    return null;
  }

  // Fetch the article content and Wikidata ID in parallel
  const [content, wikidataId] = await Promise.all([
    fetchWikipediaContent(searchResult.title),
    fetchWikidataId(searchResult.pageid),
  ]);

  if (!content) {
    return null;
  }

  // Parse the infobox
  const infobox = parseStationInfobox(content);
  if (!infobox) {
    return null;
  }

  // If no coordinates from wikitext, try Wikidata
  if (!infobox.coordinates && wikidataId) {
    const wikidataCoords = await fetchWikidataCoordinates(wikidataId);
    if (wikidataCoords) {
      infobox.coordinates = wikidataCoords;
    }
  }

  // Add Wikipedia URL
  infobox.wikipediaUrl = `https://it.wikipedia.org/wiki/${encodeURIComponent(searchResult.title.replace(/ /g, "_"))}`;

  return infobox;
}

/**
 * Search Wikipedia for a station article
 */
async function searchWikipedia(
  stationName: string,
): Promise<{ title: string; pageid: number } | null> {
  // Try different search queries
  const searchQueries = [
    `Stazione di ${stationName}`,
    `Stazione ferroviaria di ${stationName}`,
    `Fermata di ${stationName}`,
    stationName,
  ];

  for (const query of searchQueries) {
    const params = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: query,
      srlimit: "5",
      format: "json",
      origin: "*",
    });

    try {
      const response = await fetch(`${WIKIPEDIA_API}?${params}`);
      if (!response.ok) continue;

      const data: WikipediaSearchResponse = await response.json();
      const results = data.query?.search ?? [];

      // Find a result that looks like a station article
      const stationResult = results.find((r) => {
        const titleLower = r.title.toLowerCase();
        return (
          titleLower.includes("stazione") ||
          titleLower.includes("fermata") ||
          titleLower.includes(stationName.toLowerCase())
        );
      });

      if (stationResult) {
        return {
          title: stationResult.title,
          pageid: stationResult.pageid,
        };
      }
    } catch {
      // Continue to next query
    }
  }

  return null;
}

/**
 * Fetch Wikipedia article content
 */
async function fetchWikipediaContent(title: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    titles: title,
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    format: "json",
    origin: "*",
  });

  try {
    const response = await fetch(`${WIKIPEDIA_API}?${params}`);
    if (!response.ok) return null;

    const data: WikipediaContentResponse = await response.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    // Get the first (and only) page
    const page = Object.values(pages)[0];
    if (!page?.revisions?.[0]) return null;

    const revision = page.revisions[0];
    // Handle both old and new API response formats
    const content =
      revision.slots?.main?.["*"] ??
      revision.slots?.main?.content ??
      revision["*"];

    return content ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the Wikidata ID for a Wikipedia page
 */
async function fetchWikidataId(pageid: number): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    pageids: pageid.toString(),
    prop: "pageprops",
    ppprop: "wikibase_item",
    format: "json",
    origin: "*",
  });

  try {
    const response = await fetch(`${WIKIPEDIA_API}?${params}`);
    if (!response.ok) return null;

    const data = await response.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as {
      pageprops?: { wikibase_item?: string };
    };
    return page?.pageprops?.wikibase_item ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch coordinates from Wikidata
 */
async function fetchWikidataCoordinates(
  wikidataId: string,
): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    action: "wbgetentities",
    ids: wikidataId,
    props: "claims",
    format: "json",
    origin: "*",
  });

  try {
    const response = await fetch(`${WIKIDATA_API}?${params}`);
    if (!response.ok) return null;

    const data = await response.json();
    const entity = data.entities?.[wikidataId];
    if (!entity) return null;

    // P625 is the coordinate location property
    const coordClaim = entity.claims?.P625?.[0];
    const coordValue = coordClaim?.mainsnak?.datavalue?.value;

    if (
      coordValue?.latitude !== undefined &&
      coordValue?.longitude !== undefined
    ) {
      return {
        lat: coordValue.latitude,
        lng: coordValue.longitude,
      };
    }

    return null;
  } catch {
    return null;
  }
}
