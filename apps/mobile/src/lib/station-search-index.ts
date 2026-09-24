// Started from the API's search (apps/api/src/search.ts) but kept separate: on the
// device, closer stations rank higher within each match rank, and a single character
// is enough to search.
import type { Station } from "@repo/data/types";

import { distanceKm } from "@/lib/distance";
import type { UserLocation } from "@/lib/user-location";

type IndexedVariant = {
  normalizedName: string;
  words: string[];
};

type IndexedStation = {
  station: Station;
  normalizedId: string;
  variants: IndexedVariant[];
};

type SearchResult = {
  station: Station;
  rank: number;
  /** Orders stations that match equally well: importance, weighted by distance when known. */
  score: number;
  variantLength: number;
};

export type StationSearchOptions = {
  limit?: number;
  /** Where the user is. Within each match rank, closer stations come first. */
  near?: UserLocation | null;
};

// The same station ID shape as the API's STATION_ID_PATTERN.
const STATION_ID_REGEX = /^[A-Z]{2,3}\d+$/;
const DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const WHITESPACE_REGEX = /\s+/g;

function normalizeText(text: string): string {
  return text.normalize("NFD").replace(DIACRITICS_REGEX, "").toLowerCase().trim();
}

function tokenizeText(text: string): string[] {
  return normalizeText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function normalizeStationId(text: string): string {
  return text.trim().replace(WHITESPACE_REGEX, "").toUpperCase();
}

function getNameVariants(name: string): string[] {
  const variants = new Map<string, string>();

  for (const candidate of [name, ...name.split("/").map((part) => part.trim())]) {
    if (!candidate) continue;

    const normalized = normalizeText(candidate);
    if (!normalized || variants.has(normalized)) continue;
    variants.set(normalized, candidate);
  }

  return [...variants.values()];
}

function buildSearchIndex(sourceStations: Station[]): {
  indexedStations: IndexedStation[];
  exactIdMap: Map<string, IndexedStation>;
} {
  const exactIdMap = new Map<string, IndexedStation>();

  const indexedStations = sourceStations.map((station) => {
    const indexedStation: IndexedStation = {
      station,
      normalizedId: normalizeStationId(station.id),
      variants: getNameVariants(station.name).map((variant) => ({
        normalizedName: normalizeText(variant),
        words: tokenizeText(variant),
      })),
    };

    exactIdMap.set(indexedStation.normalizedId, indexedStation);
    return indexedStation;
  });

  return { indexedStations, exactIdMap };
}

// One importance step is worth the distance growing ~1.6x (e^0.5). So the main
// station a few km away still beats a minor one next door, but a far-off hub doesn't
// beat the local stations, and from far away, importance decides.
const IMPORTANCE_WEIGHT = 0.5;

function getScore(station: Station, near: UserLocation | null | undefined): number {
  if (!near || !station.geo) return station.importance;
  return Math.log1p(distanceKm(near, station.geo)) + (station.importance - 1) * IMPORTANCE_WEIGHT;
}

function compareSearchResults(a: SearchResult, b: SearchResult): number {
  return (
    a.rank - b.rank ||
    a.score - b.score ||
    a.variantLength - b.variantLength ||
    a.station.name.localeCompare(b.station.name) ||
    a.station.id.localeCompare(b.station.id)
  );
}

function insertTopResult(results: SearchResult[], candidate: SearchResult, limit: number): void {
  let insertAt = results.length;

  for (let i = 0; i < results.length; i++) {
    if (compareSearchResults(candidate, results[i]!) < 0) {
      insertAt = i;
      break;
    }
  }

  if (insertAt === results.length) {
    if (results.length < limit) {
      results.push(candidate);
    }
    return;
  }

  results.splice(insertAt, 0, candidate);
  if (results.length > limit) {
    results.pop();
  }
}

function matchesWordPrefixesInOrder(queryWords: string[], nameWords: string[]): boolean {
  let queryIndex = 0;

  for (const nameWord of nameWords) {
    if (nameWord.startsWith(queryWords[queryIndex]!)) {
      queryIndex++;
      if (queryIndex === queryWords.length) {
        return true;
      }
    }
  }

  return queryIndex === queryWords.length;
}

function matchesWordPrefixes(queryWords: string[], nameWords: string[]): boolean {
  return queryWords.every((queryWord) =>
    nameWords.some((nameWord) => nameWord.startsWith(queryWord)),
  );
}

function getVariantRank(
  variant: IndexedVariant,
  normalizedQuery: string,
  queryWords: string[],
): number | null {
  if (variant.normalizedName === normalizedQuery) {
    return 2;
  }

  if (variant.normalizedName.startsWith(normalizedQuery)) {
    return 3;
  }

  if (queryWords.length > 0 && matchesWordPrefixesInOrder(queryWords, variant.words)) {
    return 4;
  }

  if (queryWords.length > 0 && matchesWordPrefixes(queryWords, variant.words)) {
    return 5;
  }

  if (variant.words.some((word) => word.startsWith(normalizedQuery))) {
    return 6;
  }

  if (variant.normalizedName.includes(normalizedQuery)) {
    return 7;
  }

  return null;
}

function getStationMatch(
  indexedStation: IndexedStation,
  normalizedQuery: string,
  queryWords: string[],
): Omit<SearchResult, "score"> | null {
  let bestMatch: Omit<SearchResult, "score"> | null = null;

  for (const variant of indexedStation.variants) {
    const rank = getVariantRank(variant, normalizedQuery, queryWords);
    if (rank === null) continue;

    const candidate = {
      station: indexedStation.station,
      rank,
      variantLength: variant.normalizedName.length,
    };

    // Same station, so only the rank and the variant's length can differ.
    if (
      !bestMatch ||
      (candidate.rank - bestMatch.rank || candidate.variantLength - bestMatch.variantLength) < 0
    ) {
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

export function createStationSearch(sourceStations: Station[]) {
  const searchIndex = buildSearchIndex(sourceStations);

  return function searchStations(
    query: string,
    { limit = 20, near }: StationSearchOptions = {},
  ): Station[] {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || limit <= 0) {
      return [];
    }

    const normalizedIdQuery = normalizeStationId(trimmedQuery);
    const exactIdMatch = STATION_ID_REGEX.test(normalizedIdQuery)
      ? (searchIndex.exactIdMap.get(normalizedIdQuery) ?? null)
      : null;

    const normalizedQuery = normalizeText(trimmedQuery);
    if (!normalizedQuery) {
      return [];
    }

    const queryWords = tokenizeText(trimmedQuery);
    const results: SearchResult[] = [];
    const seenStationIds = new Set<string>();

    if (exactIdMatch) {
      insertTopResult(
        results,
        {
          station: exactIdMatch.station,
          rank: 1,
          score: 0,
          variantLength: exactIdMatch.station.id.length,
        },
        limit,
      );
      seenStationIds.add(exactIdMatch.station.id);
    }

    for (const indexedStation of searchIndex.indexedStations) {
      if (seenStationIds.has(indexedStation.station.id)) continue;

      const match = getStationMatch(indexedStation, normalizedQuery, queryWords);
      if (!match) continue;

      insertTopResult(results, { ...match, score: getScore(match.station, near) }, limit);
    }

    return results.map(({ station }) => station);
  };
}
