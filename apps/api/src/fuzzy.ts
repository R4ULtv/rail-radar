import {
  COUNTRY_CODES,
  COUNTRY_MAP,
  getCountry,
  type CountryCode,
  type CountryName,
  type Station,
} from "@repo/data";

const COUNTRY_NAME_TO_CODE = Object.fromEntries(
  Object.entries(COUNTRY_MAP).map(([code, name]) => [name.toLowerCase(), code]),
) as Record<Lowercase<CountryName>, CountryCode>;

const STATION_TYPES = ["rail", "metro", "light"] as const;
type StationType = (typeof STATION_TYPES)[number];

type IndexedName = {
  normalized: string;
  words: string[];
};

type IndexedStation = {
  station: Station;
  country: CountryCode | null;
  names: IndexedName[];
};

type SearchIndex = {
  indexedStations: IndexedStation[];
  exactIdMap: Map<string, IndexedStation[]>;
  numericIdMap: Map<string, IndexedStation[]>;
  wordPrefixMap: Map<string, IndexedStation[]>;
};

export type ParsedQuery = {
  coords: { lat: number; lng: number } | null;
  country: CountryCode | null;
  type: StationType | null;
  nameQuery: string;
};

const COORDS_REGEX = /^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/;

/** Parse a search query into coords (lat,lng), country/type filters, and a name query. */
export function parseQuery(q: string): ParsedQuery {
  const trimmed = q.trim();

  const coordMatch = trimmed.match(COORDS_REGEX);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]!);
    const lng = parseFloat(coordMatch[2]!);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { coords: { lat, lng }, country: null, type: null, nameQuery: "" };
    }
  }

  const tokens = trimmed.toLowerCase().split(/\s+/);
  let country: CountryCode | null = null;
  let type: StationType | null = null;
  const remaining: string[] = [];

  for (const token of tokens) {
    if (!country) {
      if (token in COUNTRY_NAME_TO_CODE) {
        country = COUNTRY_NAME_TO_CODE[token as Lowercase<CountryName>];
        continue;
      }
      if (COUNTRY_CODES.includes(token as CountryCode)) {
        country = token as CountryCode;
        continue;
      }
    }
    if (!type && STATION_TYPES.includes(token as StationType)) {
      type = token as StationType;
      continue;
    }
    remaining.push(token);
  }

  return {
    coords: null,
    country,
    type,
    nameQuery: remaining.join(" "),
  };
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Find the nearest stations to a coordinate, sorted by distance then importance. */
export function geoSearch(
  stations: Station[],
  lat: number,
  lng: number,
  limit: number = 20,
  filters?: { country?: CountryCode | null; type?: StationType | null },
): Station[] {
  const results: { station: Station; distance: number }[] = [];

  for (const station of stations) {
    if (!station.geo) continue;
    if (filters?.country && getCountry(station.id) !== filters.country) continue;
    if (filters?.type && station.type !== filters.type) continue;

    pushRankedResult(
      results,
      {
        station,
        distance: haversineDistance(lat, lng, station.geo.lat, station.geo.lng),
      },
      limit,
      compareGeoResults,
    );
  }

  return results.map(({ station }) => station);
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenizeText(text: string): string[] {
  return normalizeText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0);
}

function normalizeStationId(text: string): string {
  return text.trim().replace(/\s+/g, "").toUpperCase();
}

const searchIndexCache = new WeakMap<Station[], SearchIndex>();
const MAX_PREFIX_INDEX_LENGTH = 6;

function getSearchableNames(station: Station): string[] {
  const names: string[] = [station.name];

  if (station.name.includes("/")) {
    const parts = station.name.split("/").map((p) => p.trim());
    names.push(...parts);
  }

  return names;
}

function addIndexedStationToMap(
  map: Map<string, IndexedStation[]>,
  key: string,
  indexedStation: IndexedStation,
): void {
  const matches = map.get(key);
  if (matches) {
    matches.push(indexedStation);
  } else {
    map.set(key, [indexedStation]);
  }
}

function buildSearchIndex(stations: Station[]): SearchIndex {
  const exactIdMap = new Map<string, IndexedStation[]>();
  const numericIdMap = new Map<string, IndexedStation[]>();
  const wordPrefixMap = new Map<string, IndexedStation[]>();

  const indexedStations = stations.map((station) => {
    const normalizedId = normalizeStationId(station.id);
    const numericId = normalizedId.replace(/^[A-Z]+/, "");
    const indexedStation: IndexedStation = {
      station,
      country: getCountry(station.id),
      names: getSearchableNames(station).map((name) => {
        const normalized = normalizeText(name);
        return {
          normalized,
          words: tokenizeText(name),
        };
      }),
    };

    addIndexedStationToMap(exactIdMap, normalizedId, indexedStation);

    if (numericId) {
      addIndexedStationToMap(numericIdMap, numericId, indexedStation);
    }

    const seenPrefixes = new Set<string>();
    for (const name of indexedStation.names) {
      for (const word of name.words) {
        const maxPrefixLength = Math.min(word.length, MAX_PREFIX_INDEX_LENGTH);
        for (let i = 1; i <= maxPrefixLength; i++) {
          const prefix = word.slice(0, i);
          if (seenPrefixes.has(prefix)) continue;
          seenPrefixes.add(prefix);
          addIndexedStationToMap(wordPrefixMap, prefix, indexedStation);
        }
      }
    }

    return indexedStation;
  });

  return { indexedStations, exactIdMap, numericIdMap, wordPrefixMap };
}

function getSearchIndex(stations: Station[]): SearchIndex {
  const cached = searchIndexCache.get(stations);
  if (cached) {
    return cached;
  }

  const index = buildSearchIndex(stations);
  searchIndexCache.set(stations, index);
  return index;
}

function filterIndexedStations(
  indexedStations: IndexedStation[],
  filters?: { country?: CountryCode | null; type?: StationType | null },
): IndexedStation[] {
  const country = filters?.country;
  const type = filters?.type;

  if (!country && !type) {
    return indexedStations;
  }

  return indexedStations.filter(({ station, country: stationCountry }) => {
    if (country && stationCountry !== country) return false;
    if (type && station.type !== type) return false;
    return true;
  });
}

function compareGeoResults(
  a: { station: Station; distance: number },
  b: { station: Station; distance: number },
): number {
  return a.distance - b.distance || a.station.importance - b.station.importance;
}

function compareFuzzyResults(
  a: { station: Station; score: number; matchType: number },
  b: { station: Station; score: number; matchType: number },
): number {
  if (a.matchType !== b.matchType) return a.matchType - b.matchType;
  if (a.station.importance !== b.station.importance)
    return a.station.importance - b.station.importance;
  return b.score - a.score;
}

function pushRankedResult<T>(
  results: T[],
  item: T,
  limit: number,
  compare: (a: T, b: T) => number,
): void {
  let insertAt = results.length;

  for (let i = 0; i < results.length; i++) {
    if (compare(item, results[i]!) < 0) {
      insertAt = i;
      break;
    }
  }

  if (insertAt === results.length) {
    if (results.length < limit) {
      results.push(item);
    }
    return;
  }

  results.splice(insertAt, 0, item);
  if (results.length > limit) {
    results.pop();
  }
}

function getCandidateStations(
  index: SearchIndex,
  pool: IndexedStation[],
  queryWords: string[],
): IndexedStation[] {
  const informativeWords = queryWords.filter((queryWord) => queryWord.length >= 2);

  if (informativeWords.length === 0) {
    return pool;
  }

  let candidateIds: Set<string> | null = null;

  for (const queryWord of informativeWords) {
    let matches: IndexedStation[] | undefined;

    for (
      let prefixLength = Math.min(queryWord.length, MAX_PREFIX_INDEX_LENGTH);
      prefixLength >= 2;
      prefixLength--
    ) {
      const prefix = queryWord.slice(0, prefixLength);
      matches = index.wordPrefixMap.get(prefix);
      if (matches && matches.length > 0) {
        break;
      }
    }

    if (!matches || matches.length === 0) {
      continue;
    }

    const matchIds = new Set(matches.map(({ station }) => station.id));
    if (candidateIds === null) {
      candidateIds = matchIds;
    } else {
      const intersection = new Set<string>();
      for (const stationId of candidateIds) {
        if (matchIds.has(stationId)) {
          intersection.add(stationId);
        }
      }
      candidateIds = intersection;
    }

    if (candidateIds.size === 0) {
      break;
    }
  }

  if (!candidateIds || candidateIds.size === 0) {
    return [];
  }

  const candidates = pool.filter(({ station }) => candidateIds.has(station.id));
  return candidates.length > 0 ? candidates : [];
}

function damerauLevenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;

      matrix[i]![j] = Math.min(
        matrix[i - 1]![j - 1]! + cost,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j]! + 1,
      );

      if (
        i > 1 &&
        j > 1 &&
        b.charAt(i - 1) === a.charAt(j - 2) &&
        b.charAt(i - 2) === a.charAt(j - 1)
      ) {
        matrix[i]![j] = Math.min(matrix[i]![j]!, matrix[i - 2]![j - 2]! + cost);
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

function scoreWordAgainstWord(
  queryWord: string,
  nameWord: string,
): { score: number; matchType: number } {
  if (nameWord === queryWord) return { score: 1.0, matchType: 0 };
  if (nameWord.startsWith(queryWord)) return { score: 0.95, matchType: 1 };
  if (nameWord.includes(queryWord)) return { score: 0.7, matchType: 3 };

  const compareWord =
    nameWord.length > queryWord.length + 2 ? nameWord.slice(0, queryWord.length + 2) : nameWord;
  const distance = damerauLevenshtein(queryWord, compareWord);

  const maxAllowedDistance = Math.min(2, Math.floor(queryWord.length / 2));
  if (distance > maxAllowedDistance) {
    return { score: 0, matchType: 5 };
  }

  const maxLen = Math.max(queryWord.length, compareWord.length);
  let similarity = maxLen > 0 ? 1 - distance / maxLen : 0;

  if (queryWord.length > 0 && nameWord.length > 0 && queryWord[0] === nameWord[0]) {
    similarity = similarity * 0.8 + 0.2;
  }

  return { score: similarity * 0.6, matchType: 4 };
}

function scoreAgainstName(query: string, name: IndexedName): { score: number; matchType: number } {
  const q = query;
  const n = name.normalized;
  const nameWords = name.words;

  if (n === q) return { score: 1.0, matchType: 0 };
  if (n.startsWith(q)) return { score: 0.95, matchType: 1 };
  if (nameWords.some((w) => w.startsWith(q))) return { score: 0.9, matchType: 2 };
  if (n.includes(q)) return { score: 0.7, matchType: 3 };

  let bestScore = 0;
  for (const word of nameWords) {
    const result = scoreWordAgainstWord(q, word);
    if (result.score > bestScore) {
      bestScore = result.score;
    }
  }

  return { score: bestScore, matchType: 4 };
}

function scoreMultiWordQuery(
  queryWords: string[],
  name: IndexedName,
): { score: number; matchType: number } {
  const nameWords = name.words;
  const wordScores: { score: number; matchType: number }[] = [];

  for (const qWord of queryWords) {
    let bestForWord = { score: 0, matchType: 5 };

    for (const nWord of nameWords) {
      const result = scoreWordAgainstWord(qWord, nWord);
      if (
        result.matchType < bestForWord.matchType ||
        (result.matchType === bestForWord.matchType && result.score > bestForWord.score)
      ) {
        bestForWord = result;
      }
    }

    if (bestForWord.score < 0.3) {
      return { score: 0, matchType: 5 };
    }

    wordScores.push(bestForWord);
  }

  const worstScore = Math.min(...wordScores.map((ws) => ws.score));
  const worstMatchType = Math.max(...wordScores.map((ws) => ws.matchType));

  return { score: worstScore, matchType: worstMatchType };
}

function findDirectIdMatches(query: string, index: SearchIndex): IndexedStation[] {
  const normalizedQuery = normalizeStationId(query);

  if (!normalizedQuery) {
    return [];
  }

  const exact = index.exactIdMap.get(normalizedQuery);
  if (exact && exact.length > 0) {
    return exact;
  }

  const numericQuery = normalizedQuery.replace(/^[A-Z]+/, "");
  if (!numericQuery) {
    return [];
  }

  return index.numericIdMap.get(numericQuery) ?? [];
}

/** Score a station against a query, checking all searchable names (including "/" splits). */
function scoreStation(
  normalizedQuery: string,
  queryWords: string[],
  indexedStation: IndexedStation,
): { score: number; matchType: number } {
  const names = indexedStation.names;

  if (queryWords.length === 1) {
    let best = { score: 0, matchType: 5 };
    for (const name of names) {
      const result = scoreAgainstName(normalizedQuery, name);
      if (
        result.matchType < best.matchType ||
        (result.matchType === best.matchType && result.score > best.score)
      ) {
        best = result;
      }
    }
    return best;
  }

  let best = { score: 0, matchType: 5 };

  for (const name of names) {
    const exactResult = scoreAgainstName(normalizedQuery, name);
    if (
      exactResult.matchType < best.matchType ||
      (exactResult.matchType === best.matchType && exactResult.score > best.score)
    ) {
      best = exactResult;
    }

    const multiResult = scoreMultiWordQuery(queryWords, name);
    if (
      multiResult.matchType < best.matchType ||
      (multiResult.matchType === best.matchType && multiResult.score > best.score)
    ) {
      best = multiResult;
    }
  }

  return best;
}

/** Search stations with fuzzy matching, ranked by match type → importance → score. */
export function fuzzySearch(
  stations: Station[],
  query: string,
  limit: number = 20,
  filters?: { country?: CountryCode | null; type?: StationType | null },
): Station[] {
  const index = getSearchIndex(stations);
  const pool = filterIndexedStations(index.indexedStations, filters);

  if (!query.trim()) {
    return pool
      .slice()
      .sort((a, b) => a.station.importance - b.station.importance)
      .slice(0, limit)
      .map(({ station }) => station);
  }

  const normalizedQuery = normalizeText(query);
  const queryWords = tokenizeText(query);
  const candidates = getCandidateStations(index, pool, queryWords);
  const directIdMatches = filterIndexedStations(findDirectIdMatches(query, index), filters).sort(
    (a, b) =>
      a.station.importance - b.station.importance || a.station.name.localeCompare(b.station.name),
  );

  if (directIdMatches.length > 0) {
    const exactStation = directIdMatches[0]!.station;
    const directIdMatchIds = new Set(directIdMatches.map(({ station }) => station.id));

    if (!exactStation.geo) {
      return directIdMatches.slice(0, limit).map(({ station }) => station);
    }

    const nearbyStations = geoSearch(
      stations,
      exactStation.geo.lat,
      exactStation.geo.lng,
      limit,
      filters,
    ).filter((station) => !directIdMatchIds.has(station.id));

    return [...directIdMatches.map(({ station }) => station), ...nearbyStations].slice(0, limit);
  }

  const scored: { station: Station; score: number; matchType: number }[] = [];

  for (const indexedStation of candidates) {
    const result = scoreStation(normalizedQuery, queryWords, indexedStation);
    if (result.score <= 0.3) continue;

    pushRankedResult(
      scored,
      {
        station: indexedStation.station,
        score: result.score,
        matchType: result.matchType,
      },
      limit,
      compareFuzzyResults,
    );
  }

  return scored.map(({ station }) => station);
}
