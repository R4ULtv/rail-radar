// Started from the API's search (apps/api/src/search.ts) but kept separate: on the
// device, saved and recent stations come first, closer stations rank higher among ones that
// match equally well, and a single character is enough to search.
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
  /** The user's own stations come first: see the `*_GROUP` constants. */
  group: number;
  rank: number;
  /** Orders stations that match equally well, before their type: see `DISTANCE_BANDS_KM`. */
  distanceBand: number;
  /** Km from the user, 0 without their location. Orders the last ties before the names. */
  distance: number;
  variantLength: number;
  /** The full name without accents or case, to order the remaining ties alphabetically. */
  sortName: string;
};

export type StationSearchOptions = {
  limit?: number;
  /** Where the user is. Among stations that match equally well, closer ones come first. */
  near?: UserLocation | null;
  /** The user's saved stations, which come first when they match. */
  saved?: readonly Station[];
  /** The user's recent stations, which come after the saved ones. */
  recent?: readonly Station[];
};

// The same station ID shape as the API's STATION_ID_PATTERN.
const STATION_ID_REGEX = /^[A-Z]{2,3}\d+$/;
const PRINTABLE_ASCII_REGEX = /^[ -~]*$/;
const DIACRITICS_REGEX = /[\u0300-\u036f]/g;
const WHITESPACE_REGEX = /\s+/g;
const WORD_SEPARATOR_REGEX = /[^\p{L}\p{N}]+/u;
const EXACT_ID_GROUP = 0;
const SAVED_GROUP = 1;
const RECENT_GROUP = 2;
const OTHER_GROUP = 3;
/** The rank of a name equal to the query, the best a name can match. */
const EXACT_NAME_RANK = 2;
const WORST_RANK = 7;
/** Ranks up to this one need a name starting with the query. */
const PREFIX_RANK = 3;
/**
 * Ranks up to this one need a word starting with the query. The user's stations need one too to
 * come first, so "mi" doesn't bring up a saved Roma Termini.
 */
const WORD_START_RANK = 6;

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

// Distance only orders stations in different bands, so within one the type and importance
// decide: from Cremona, Milano Centrale (75 km) beats the closer Miradolo Terme (45 km), but
// neither beats a station in town.
const DISTANCE_BANDS_KM = [10, 100, 300];

function getDistanceBand(distance: number): number {
  let band = 0;
  while (band < DISTANCE_BANDS_KM.length && distance >= DISTANCE_BANDS_KM[band]!) band++;
  return band;
}

type StationMatch = Omit<SearchResult, "group" | "distanceBand" | "distance">;

// Built field by field: it runs for every matching station, and spreading is slower on the
// device's JS engine.
function toSearchResult(
  match: StationMatch,
  group: number,
  near: UserLocation | null | undefined,
): SearchResult {
  const { station } = match;
  const distance = !near ? 0 : station.geo ? distanceKm(near, station.geo) : Infinity;
  return {
    station,
    group,
    rank: match.rank,
    distanceBand: getDistanceBand(distance),
    distance,
    variantLength: match.variantLength,
    sortName: match.sortName,
  };
}

// Not localeCompare: it's called for many ties, and it's slow on the device's JS engine.
// Comparing the normalized names instead gets close to alphabetical order.
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Rail stations before metro stations, and those before light rail. */
const TYPE_ORDER: Record<Station["type"], number> = { rail: 0, metro: 1, light: 2 };

function compareSearchResults(a: SearchResult, b: SearchResult): number {
  return (
    a.group - b.group ||
    a.rank - b.rank ||
    a.distanceBand - b.distanceBand ||
    TYPE_ORDER[a.station.type] - TYPE_ORDER[b.station.type] ||
    a.station.importance - b.station.importance ||
    a.distance - b.distance ||
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
    return EXACT_NAME_RANK;
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
    return WORD_START_RANK;
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
): StationMatch | null {
  let bestMatch: StationMatch | null = null;

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
    { limit = 20, near, saved = [], recent = [] }: StationSearchOptions = {},
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
          group: EXACT_ID_GROUP,
          rank: 1,
          distanceBand: 0,
          distance: 0,
          variantLength: exactIdMatch.station.id.length,
          sortName: "",
        },
        limit,
      );
    }

    // The user's own stations are few, so they're checked directly, and skipped below.
    const userGroups = new Map<IndexedStation, number>();
    for (const [stations, group] of [
      [saved, SAVED_GROUP],
      [recent, RECENT_GROUP],
    ] as const) {
      for (const { id } of stations) {
        const indexedStation = searchIndex.exactIdMap.get(normalizeStationId(id));
        if (!indexedStation || indexedStation === exactIdMatch || userGroups.has(indexedStation)) {
          continue;
        }
        userGroups.set(indexedStation, group);

        const match = getStationMatch(indexedStation, normalizedQuery, queryWords, WORST_RANK);
        if (match) {
          insertTopResult(
            results,
            toSearchResult(match, match.rank <= WORD_START_RANK ? group : OTHER_GROUP, near),
            limit,
          );
        }
      }
    }

    // Every rank needs the name to contain the whole query, or each of its words.
    const requiredText = longestText(queryWords) ?? normalizedQuery;
    const prefixText = `\n${normalizedQuery}`;

    /** The worst rank another station can have and still make the results. */
    function getMaxRank(): number {
      if (results.length < limit) return WORST_RANK;
      const last = results[limit - 1]!;
      // No other station can beat one of the user's.
      return last.group < OTHER_GROUP ? 0 : last.rank;
    }

    function findNextMatch(from: number): number {
      const maxRank = getMaxRank();
      if (maxRank < EXACT_NAME_RANK) return -1;
      // Once only names starting with the query can still make the results, as with most
      // single letters, just those are visited.
      if (maxRank <= PREFIX_RANK) {
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

      if (indexedStation !== exactIdMatch && !userGroups.has(indexedStation)) {
        const match = getStationMatch(indexedStation, normalizedQuery, queryWords, getMaxRank());
        if (match) {
          insertTopResult(results, toSearchResult(match, OTHER_GROUP, near), limit);
        }
      }

      position = findNextMatch(nameStarts[stationIndex + 1]!);
    }

    return results.map(({ station }) => station);
  };
}
