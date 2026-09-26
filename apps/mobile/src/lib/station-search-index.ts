// Started from the API's search (apps/api/src/search.ts) but kept separate: on the
// device, closer stations rank higher within each match rank, and a single character
// is enough to search.
import type { Station } from "@repo/data/types";

import { distanceKm } from "@/lib/distance";
import type { UserLocation } from "@/lib/user-location";

type IndexedVariant = {
  normalizedName: string;
  /** Split on first use: most searches rule a station in or out before its words are needed. */
  words?: string[];
};

type IndexedStation = {
  station: Station;
  normalizedId: string;
  variants: IndexedVariant[];
};

type SearchIndex = {
  indexedStations: IndexedStation[];
  exactIdMap: Map<string, IndexedStation>;
  /**
   * Every station's names, each on its own line. Any match contains the query's longest word,
   * so finding it here with `indexOf` skips the stations that can't match without visiting them.
   */
  names: string;
  /** Where each station's lines start in `names`, plus the end. */
  nameStarts: Int32Array;
};

type SearchResult = {
  station: Station;
  rank: number;
  /** Orders stations that match equally well: importance, weighted by distance when known. */
  score: number;
  variantLength: number;
  /** The full name without accents or case, to order the remaining ties alphabetically. */
  sortName: string;
};

export type StationSearchOptions = {
  limit?: number;
  /** Where the user is. Within each match rank, closer stations come first. */
  near?: UserLocation | null;
};

// The same station ID shape as the API's STATION_ID_PATTERN.
const STATION_ID_REGEX = /^[A-Z]{2,3}\d+$/;
const PRINTABLE_ASCII_REGEX = /^[ -~]*$/;
const DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const WHITESPACE_REGEX = /\s+/g;
const WORD_SEPARATOR_REGEX = /[^\p{L}\p{N}]+/u;
const WORST_RANK = 7;
/** Ranks up to this one need a name starting with the query. */
const PREFIX_RANK = 3;

function normalizeText(text: string): string {
  // Plain ASCII has no diacritics to strip, and skipping the Unicode normalization for it keeps
  // building the index fast.
  const stripped = PRINTABLE_ASCII_REGEX.test(text)
    ? text
    : text.normalize("NFD").replace(DIACRITICS_REGEX, "");
  return stripped.toLowerCase().trim();
}

function splitWords(normalizedText: string): string[] {
  return normalizedText.split(WORD_SEPARATOR_REGEX).filter(Boolean);
}

function getWords(variant: IndexedVariant): string[] {
  variant.words ??= splitWords(variant.normalizedName);
  return variant.words;
}

function normalizeStationId(text: string): string {
  return text.trim().replace(WHITESPACE_REGEX, "").toUpperCase();
}

function getNameVariants(name: string): IndexedVariant[] {
  const candidates = name.includes("/") ? [name, ...name.split("/")] : [name];
  const normalizedNames = new Set<string>();

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (normalized) normalizedNames.add(normalized);
  }

  return [...normalizedNames].map((normalizedName) => ({ normalizedName }));
}

function buildSearchIndex(sourceStations: Station[]): SearchIndex {
  const exactIdMap = new Map<string, IndexedStation>();
  const nameLines: string[] = [];
  const nameStarts = new Int32Array(sourceStations.length + 1);
  // Starts with a line break too, so every name follows one.
  let offset = 1;

  const indexedStations = sourceStations.map((station, index) => {
    const indexedStation: IndexedStation = {
      station,
      normalizedId: normalizeStationId(station.id),
      variants: getNameVariants(station.name),
    };
    exactIdMap.set(indexedStation.normalizedId, indexedStation);

    // A line break never ends up in a query, so a match can't span two stations.
    const lines = `${indexedStation.variants.map((variant) => variant.normalizedName).join("\n")}\n`;
    nameStarts[index] = offset;
    nameLines.push(lines);
    offset += lines.length;

    return indexedStation;
  });
  nameStarts[sourceStations.length] = offset;

  return { indexedStations, exactIdMap, names: `\n${nameLines.join("")}`, nameStarts };
}

/** The station whose lines in `names` contain `position`, searching from `from` on. */
function findStationAt(nameStarts: Int32Array, position: number, from: number): number {
  let low = from;
  let high = nameStarts.length - 2;

  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (nameStarts[middle]! <= position) low = middle;
    else high = middle - 1;
  }

  return low;
}

// One importance step is worth the distance growing ~1.6x (e^0.5). So the main
// station a few km away still beats a minor one next door, but a far-off hub doesn't
// beat the local stations, and from far away, importance decides.
const IMPORTANCE_WEIGHT = 0.5;

function getScore(station: Station, near: UserLocation | null | undefined): number {
  if (!near || !station.geo) return station.importance;
  return Math.log1p(distanceKm(near, station.geo)) + (station.importance - 1) * IMPORTANCE_WEIGHT;
}

// Not localeCompare: it's called for many ties, and it's slow on the device's JS engine.
// Comparing the normalized names instead gets close to alphabetical order.
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareSearchResults(a: SearchResult, b: SearchResult): number {
  return (
    a.rank - b.rank ||
    a.score - b.score ||
    a.variantLength - b.variantLength ||
    compareText(a.sortName, b.sortName) ||
    compareText(a.station.name, b.station.name) ||
    compareText(a.station.id, b.station.id)
  );
}

function insertTopResult(results: SearchResult[], candidate: SearchResult, limit: number): void {
  // Most candidates don't beat the last result, so that's checked first.
  if (results.length === limit && compareSearchResults(candidate, results[limit - 1]!) >= 0) {
    return;
  }

  let insertAt = results.length;
  while (insertAt > 0 && compareSearchResults(candidate, results[insertAt - 1]!) < 0) {
    insertAt--;
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

/** Ranks worse than `maxRank` can't make the results, so they aren't checked. */
function getVariantRank(
  variant: IndexedVariant,
  normalizedQuery: string,
  queryWords: string[],
  maxRank: number,
): number | null {
  if (variant.normalizedName === normalizedQuery) {
    return 2;
  }

  if (variant.normalizedName.startsWith(normalizedQuery)) {
    return 3;
  }

  if (maxRank < 4) return null;
  const words = getWords(variant);

  if (queryWords.length > 0 && matchesWordPrefixesInOrder(queryWords, words)) {
    return 4;
  }

  if (maxRank < 5) return null;
  if (queryWords.length > 0 && matchesWordPrefixes(queryWords, words)) {
    return 5;
  }

  if (maxRank < 6) return null;
  if (words.some((word) => word.startsWith(normalizedQuery))) {
    return 6;
  }

  if (maxRank < 7) return null;
  if (variant.normalizedName.includes(normalizedQuery)) {
    return 7;
  }

  return null;
}

function getStationMatch(
  indexedStation: IndexedStation,
  normalizedQuery: string,
  queryWords: string[],
  maxRank: number,
): Omit<SearchResult, "score"> | null {
  let bestMatch: Omit<SearchResult, "score"> | null = null;

  for (const variant of indexedStation.variants) {
    const rank = getVariantRank(variant, normalizedQuery, queryWords, bestMatch?.rank ?? maxRank);
    if (rank === null) continue;

    const candidate = {
      station: indexedStation.station,
      rank,
      variantLength: variant.normalizedName.length,
      sortName: indexedStation.variants[0]!.normalizedName,
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

function longestText(texts: string[]): string | undefined {
  let longest: string | undefined;
  for (const text of texts) {
    if (!longest || text.length > longest.length) longest = text;
  }
  return longest;
}

export function createStationSearch(sourceStations: Station[]) {
  const searchIndex = buildSearchIndex(sourceStations);
  const { indexedStations, names, nameStarts } = searchIndex;

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

    const queryWords = splitWords(normalizedQuery);
    const results: SearchResult[] = [];

    if (exactIdMatch) {
      insertTopResult(
        results,
        {
          station: exactIdMatch.station,
          rank: 1,
          score: 0,
          variantLength: exactIdMatch.station.id.length,
          sortName: "",
        },
        limit,
      );
    }

    // Every rank needs the name to contain the whole query, or each of its words.
    const requiredText = longestText(queryWords) ?? normalizedQuery;
    const prefixText = `\n${normalizedQuery}`;
    const getMaxRank = () => (results.length === limit ? results[limit - 1]!.rank : WORST_RANK);

    function findNextMatch(from: number): number {
      // Once only names starting with the query can still make the results, as with most
      // single letters, just those are visited.
      if (getMaxRank() <= PREFIX_RANK) {
        const lineBreak = names.indexOf(prefixText, from - 1);
        return lineBreak === -1 ? -1 : lineBreak + 1;
      }
      return names.indexOf(requiredText, from);
    }

    let stationIndex = 0;
    let position = findNextMatch(nameStarts[0]!);

    while (position !== -1) {
      stationIndex = findStationAt(nameStarts, position, stationIndex);
      const indexedStation = indexedStations[stationIndex]!;

      if (indexedStation !== exactIdMatch) {
        const match = getStationMatch(indexedStation, normalizedQuery, queryWords, getMaxRank());
        if (match) {
          insertTopResult(results, { ...match, score: getScore(match.station, near) }, limit);
        }
      }

      position = findNextMatch(nameStarts[stationIndex + 1]!);
    }

    return results.map(({ station }) => station);
  };
}
