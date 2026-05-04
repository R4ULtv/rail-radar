import { parseStationInfobox } from "$lib/wikipedia-parser";
import type {
  StationInfobox,
  WikipediaContentResponse,
  WikipediaPage,
  WikipediaSearchResponse,
} from "$lib/types/wikipedia";

const IT_WIKIPEDIA_API = "https://it.wikipedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

const COUNTRY_LANG: Record<string, string> = {
  IT: "it",
  DE: "de",
  CH: "de",
  AT: "de",
  FR: "fr",
  BE: "fr",
  NL: "nl",
  DK: "da",
  NO: "no",
  SE: "sv",
  FI: "fi",
  GB: "en",
  IE: "en",
};

const STATION_INSTANCE_IDS = new Set([
  "Q55488",
  "Q55678",
  "Q4663385",
  "Q928830",
  "Q18543139",
  "Q1311958",
  "Q124817865",
  "Q11424015",
  "Q18516972",
  "Q27996466",
]);

interface WikidataEntity {
  id: string;
  labels?: Record<string, { value: string }>;
  sitelinks?: Record<string, { title: string; url?: string }>;
  claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value: unknown } } }>>;
}

function languageForStationId(stationId: string | null | undefined): string {
  if (!stationId) return "en";
  const prefix = stationId.slice(0, 2).toUpperCase();
  return COUNTRY_LANG[prefix] ?? "en";
}

export async function fetchWikipediaStation(
  stationName: string,
  stationId: string | null = null,
): Promise<StationInfobox | null> {
  const lang = languageForStationId(stationId);
  const isItalian = lang === "it";

  if (isItalian) {
    const fromInfobox = await fetchItalianInfobox(stationName);
    if (fromInfobox) return fromInfobox;
  }

  return fetchFromWikidata(stationName, lang);
}

async function fetchItalianInfobox(stationName: string): Promise<StationInfobox | null> {
  const searchResult = await searchItalianWikipedia(stationName);
  if (!searchResult) return null;

  const [content, wikidataId] = await Promise.all([
    fetchWikipediaContent(searchResult.title),
    fetchWikidataIdForPage(searchResult.pageid),
  ]);
  if (!content) return null;

  const infobox = parseStationInfobox(content);
  if (!infobox) return null;

  if (!infobox.coordinates && wikidataId) {
    infobox.coordinates = (await fetchWikidataCoordinatesById(wikidataId)) ?? undefined;
  }

  infobox.wikipediaUrl = `https://it.wikipedia.org/wiki/${encodeURIComponent(searchResult.title.replace(/ /g, "_"))}`;
  return infobox;
}

async function fetchFromWikidata(
  stationName: string,
  lang: string,
): Promise<StationInfobox | null> {
  const candidates = await searchWikidata(stationName, lang);
  if (!candidates.length) return null;

  const entities = await getWikidataEntities(candidates.map((c) => c.id));
  const ordered = candidates
    .map((c) => entities[c.id])
    .filter((entity): entity is WikidataEntity => Boolean(entity));

  const stationEntity = ordered.find(isRailwayStation) ?? ordered.find(hasCoordinates);
  if (!stationEntity) return null;

  const coordinates = extractCoordinates(stationEntity);
  const wikipediaUrl = extractWikipediaUrl(stationEntity, lang);
  if (!coordinates && !wikipediaUrl) return null;

  return { coordinates, wikipediaUrl };
}

async function searchWikidata(query: string, lang: string): Promise<Array<{ id: string }>> {
  const params = new URLSearchParams({
    action: "wbsearchentities",
    search: query,
    language: lang,
    uselang: lang,
    type: "item",
    limit: "8",
    format: "json",
    origin: "*",
  });

  try {
    const response = await fetch(`${WIKIDATA_API}?${params}`);
    if (!response.ok) return [];
    const data = (await response.json()) as { search?: Array<{ id: string }> };
    return data.search ?? [];
  } catch {
    return [];
  }
}

async function getWikidataEntities(ids: string[]): Promise<Record<string, WikidataEntity>> {
  if (!ids.length) return {};
  const params = new URLSearchParams({
    action: "wbgetentities",
    ids: ids.join("|"),
    props: "labels|sitelinks/urls|claims",
    format: "json",
    origin: "*",
  });

  try {
    const response = await fetch(`${WIKIDATA_API}?${params}`);
    if (!response.ok) return {};
    const data = (await response.json()) as { entities?: Record<string, WikidataEntity> };
    return data.entities ?? {};
  } catch {
    return {};
  }
}

function isRailwayStation(entity: WikidataEntity): boolean {
  const claims = entity.claims?.P31 ?? [];
  return claims.some((claim) => {
    const value = claim.mainsnak?.datavalue?.value as { id?: string } | undefined;
    return value?.id ? STATION_INSTANCE_IDS.has(value.id) : false;
  });
}

function hasCoordinates(entity: WikidataEntity): boolean {
  return Boolean(extractCoordinates(entity));
}

function extractCoordinates(entity: WikidataEntity): { lat: number; lng: number } | undefined {
  const value = entity.claims?.P625?.[0]?.mainsnak?.datavalue?.value as
    | { latitude?: number; longitude?: number }
    | undefined;
  if (value?.latitude === undefined || value?.longitude === undefined) return undefined;
  return { lat: value.latitude, lng: value.longitude };
}

function extractWikipediaUrl(entity: WikidataEntity, lang: string): string | undefined {
  const link =
    entity.sitelinks?.[`${lang}wiki`] ??
    entity.sitelinks?.enwiki ??
    Object.values(entity.sitelinks ?? {}).find((entry) => entry.url);
  if (!link) return undefined;
  if (link.url) return link.url;
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(link.title.replace(/ /g, "_"))}`;
}

async function searchItalianWikipedia(
  stationName: string,
): Promise<{ title: string; pageid: number } | null> {
  for (const query of [
    `Stazione di ${stationName}`,
    `Stazione ferroviaria di ${stationName}`,
    `Fermata di ${stationName}`,
    stationName,
  ]) {
    const params = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: query,
      srlimit: "5",
      format: "json",
      origin: "*",
    });

    try {
      const response = await fetch(`${IT_WIKIPEDIA_API}?${params}`);
      if (!response.ok) continue;
      const data: WikipediaSearchResponse = await response.json();
      const result = (data.query?.search ?? []).find((item) => {
        const title = item.title.toLowerCase();
        return (
          title.includes("stazione") ||
          title.includes("fermata") ||
          title.includes(stationName.toLowerCase())
        );
      });

      if (result) return { title: result.title, pageid: result.pageid };
    } catch {
      // Try next query.
    }
  }

  return null;
}

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
    const response = await fetch(`${IT_WIKIPEDIA_API}?${params}`);
    if (!response.ok) return null;

    const data: WikipediaContentResponse = await response.json();
    const page = Object.values(data.query?.pages ?? {})[0] as WikipediaPage | undefined;
    const revision = page?.revisions?.[0];
    return (
      revision?.slots?.main?.["*"] ?? revision?.slots?.main?.content ?? revision?.["*"] ?? null
    );
  } catch {
    return null;
  }
}

async function fetchWikidataIdForPage(pageid: number): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    pageids: pageid.toString(),
    prop: "pageprops",
    ppprop: "wikibase_item",
    format: "json",
    origin: "*",
  });

  try {
    const response = await fetch(`${IT_WIKIPEDIA_API}?${params}`);
    if (!response.ok) return null;
    const data = await response.json();
    const page = Object.values(data.query?.pages ?? {})[0] as {
      pageprops?: { wikibase_item?: string };
    };
    return page.pageprops?.wikibase_item ?? null;
  } catch {
    return null;
  }
}

async function fetchWikidataCoordinatesById(
  id: string,
): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    action: "wbgetentities",
    ids: id,
    props: "claims",
    format: "json",
    origin: "*",
  });

  try {
    const response = await fetch(`${WIKIDATA_API}?${params}`);
    if (!response.ok) return null;
    const data = await response.json();
    const coordValue = data.entities?.[id]?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    if (coordValue?.latitude !== undefined && coordValue?.longitude !== undefined) {
      return { lat: coordValue.latitude, lng: coordValue.longitude };
    }
    return null;
  } catch {
    return null;
  }
}
