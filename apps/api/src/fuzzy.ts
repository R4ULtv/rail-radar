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
  return stations
    .filter((s) => {
      if (!s.geo) return false;
      if (filters?.country && getCountry(s.id) !== filters.country) return false;
      if (filters?.type && s.type !== filters.type) return false;
      return true;
    })
    .map((s) => ({
      station: s,
      distance: haversineDistance(lat, lng, s.geo!.lat, s.geo!.lng),
    }))
    .sort((a, b) => a.distance - b.distance || a.station.importance - b.station.importance)
    .slice(0, limit)
    .map(({ station }) => station);
}

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeStationId(text: string): string {
  return text.trim().replace(/\s+/g, "").toUpperCase();
}

function getSearchableNames(station: Station): string[] {
  const names: string[] = [station.name];

  if (station.name.includes("/")) {
    const parts = station.name.split("/").map((p) => p.trim());
    names.push(...parts);
  }

  return names;
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

function scoreAgainstName(query: string, name: string): { score: number; matchType: number } {
  const q = normalizeText(query);
  const n = normalizeText(name);
  const nameWords = n.split(/\s+/);

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
  name: string,
): { score: number; matchType: number } {
  const nameWords = normalizeText(name).split(/\s+/);
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

function findDirectIdMatches(query: string, stations: Station[]): Station[] {
  const normalizedQuery = normalizeStationId(query);

  if (!normalizedQuery) {
    return [];
  }

  const exact = stations.filter((station) => normalizeStationId(station.id) === normalizedQuery);
  if (exact.length > 0) {
    return exact;
  }

  const numericQuery = normalizedQuery.replace(/^[A-Z]+/, "");
  if (!numericQuery) {
    return [];
  }

  return stations.filter((station) => station.id.replace(/^[A-Z]+/, "") === numericQuery);
}

/** Score a station against a query, checking all searchable names (including "/" splits). */
function scoreStation(query: string, station: Station): { score: number; matchType: number } {
  const names = getSearchableNames(station);
  const queryWords = normalizeText(query)
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (queryWords.length === 1) {
    let best = { score: 0, matchType: 5 };
    for (const name of names) {
      const result = scoreAgainstName(query, name);
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
    const exactResult = scoreAgainstName(query, name);
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
  let pool = stations;
  if (filters?.country) {
    const cc = filters.country;
    pool = pool.filter((s) => getCountry(s.id) === cc);
  }
  if (filters?.type) {
    const t = filters.type;
    pool = pool.filter((s) => s.type === t);
  }

  if (!query.trim()) {
    return pool
      .slice()
      .sort((a, b) => a.importance - b.importance)
      .slice(0, limit);
  }

  const directIdMatches = findDirectIdMatches(query, pool).sort(
    (a, b) => a.importance - b.importance || a.name.localeCompare(b.name),
  );

  if (directIdMatches.length > 0) {
    const exactStation = directIdMatches[0]!;
    const directIdMatchIds = new Set(directIdMatches.map((station) => station.id));

    if (!exactStation.geo) {
      return directIdMatches.slice(0, limit);
    }

    const nearbyStations = geoSearch(stations, exactStation.geo.lat, exactStation.geo.lng, limit, filters)
      .filter((station) => !directIdMatchIds.has(station.id));

    return [...directIdMatches, ...nearbyStations].slice(0, limit);
  }

  const scored = pool
    .map((station) => {
      const result = scoreStation(query, station);
      return {
        station,
        score: result.score,
        matchType: result.matchType,
      };
    })
    .filter(({ score }) => score > 0.3)
    .sort((a, b) => {
      if (a.matchType !== b.matchType) return a.matchType - b.matchType;
      if (a.station.importance !== b.station.importance)
        return a.station.importance - b.station.importance;
      return b.score - a.score;
    })
    .slice(0, limit);

  return scored.map(({ station }) => station);
}
