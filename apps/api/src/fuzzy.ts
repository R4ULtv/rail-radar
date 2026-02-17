import type { Station } from "@repo/data";

/**
 * Normalize text by removing diacritics and converting to lowercase.
 * Handles accented characters like Zurich -> Zurich, Geneve -> Geneve
 */
function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Get all searchable names for a station (primary name + "/" splits for bilingual names)
 */
function getSearchableNames(station: Station): string[] {
  const names: string[] = [station.name];

  // Handle bilingual names with "/" (e.g., "Biel/Bienne" -> ["Biel", "Bienne"])
  if (station.name.includes("/")) {
    const parts = station.name.split("/").map((p) => p.trim());
    names.push(...parts);
  }

  return names;
}

/**
 * Calculate Damerau-Levenshtein distance between two strings
 * (minimum edits including transpositions to transform a into b)
 */
function damerauLevenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;

      matrix[i]![j] = Math.min(
        matrix[i - 1]![j - 1]! + cost, // substitution
        matrix[i]![j - 1]! + 1, // insertion
        matrix[i - 1]![j]! + 1, // deletion
      );

      // Transposition
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

/**
 * Score a single query word against a single name word (both already normalized)
 * Returns both match score and match type for tiered sorting
 */
function scoreWordAgainstWord(
  queryWord: string,
  nameWord: string,
): { score: number; matchType: number } {
  // Exact match
  if (nameWord === queryWord) return { score: 1.0, matchType: 0 };

  // Word starts with query
  if (nameWord.startsWith(queryWord)) return { score: 0.95, matchType: 1 };

  // Word contains query
  if (nameWord.includes(queryWord)) return { score: 0.7, matchType: 3 };

  // Fuzzy match
  const compareWord =
    nameWord.length > queryWord.length + 2
      ? nameWord.slice(0, queryWord.length + 2)
      : nameWord;
  const distance = damerauLevenshtein(queryWord, compareWord);

  const maxAllowedDistance = Math.min(2, Math.floor(queryWord.length / 2));
  if (distance > maxAllowedDistance) {
    return { score: 0, matchType: 5 };
  }

  const maxLen = Math.max(queryWord.length, compareWord.length);
  let similarity = maxLen > 0 ? 1 - distance / maxLen : 0;

  // Boost if first letter matches
  if (
    queryWord.length > 0 &&
    nameWord.length > 0 &&
    queryWord[0] === nameWord[0]
  ) {
    similarity = similarity * 0.8 + 0.2;
  }

  return { score: similarity * 0.6, matchType: 4 };
}

/**
 * Score a single name against a query (0-1, higher = better match)
 * Returns both match score and match type for tiered sorting
 */
function scoreAgainstName(
  query: string,
  name: string,
): { score: number; matchType: number } {
  const q = normalizeText(query);
  const n = normalizeText(name);
  const nameWords = n.split(/\s+/);

  // Exact match - highest priority
  if (n === q) return { score: 1.0, matchType: 0 };

  // Name starts with query - very high priority
  if (n.startsWith(q)) return { score: 0.95, matchType: 1 };

  // Any word starts with query - high priority
  if (nameWords.some((w) => w.startsWith(q)))
    return { score: 0.9, matchType: 2 };

  // Name contains query - medium priority
  if (n.includes(q)) return { score: 0.7, matchType: 3 };

  // Fuzzy match against each word, take best score
  // Only allow 1-2 mistakes max
  let bestScore = 0;
  for (const word of nameWords) {
    const result = scoreWordAgainstWord(q, word);
    if (result.score > bestScore) {
      bestScore = result.score;
    }
  }

  // Scale fuzzy matches below exact/prefix matches
  return { score: bestScore, matchType: 4 };
}

/**
 * Score a station against a multi-word query.
 * All query words must match somewhere in the station name (in any order).
 */
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
        (result.matchType === bestForWord.matchType &&
          result.score > bestForWord.score)
      ) {
        bestForWord = result;
      }
    }

    // If any word has no match, fail early
    if (bestForWord.score < 0.3) {
      return { score: 0, matchType: 5 };
    }

    wordScores.push(bestForWord);
  }

  // Score is based on worst matching word (all words must match well)
  const worstScore = Math.min(...wordScores.map((ws) => ws.score));
  const worstMatchType = Math.max(...wordScores.map((ws) => ws.matchType));

  return { score: worstScore, matchType: worstMatchType };
}

/**
 * Score a station against a query by checking primary name and "/" splits.
 * Returns the best match score across all searchable names.
 * Supports multi-word queries where words can be in any order.
 */
function scoreStation(
  query: string,
  station: Station,
): { score: number; matchType: number } {
  const names = getSearchableNames(station);
  const queryWords = normalizeText(query)
    .split(/\s+/)
    .filter((w) => w.length > 0);

  // Single word query - use existing logic
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

  // Multi-word query - check if all words match in any order
  let best = { score: 0, matchType: 5 };

  for (const name of names) {
    // First try exact/prefix match with full query (preserves "Milano Centrale" > "Centrale Milano" for exact input)
    const exactResult = scoreAgainstName(query, name);
    if (
      exactResult.matchType < best.matchType ||
      (exactResult.matchType === best.matchType &&
        exactResult.score > best.score)
    ) {
      best = exactResult;
    }

    // Then try multi-word matching (any order)
    const multiResult = scoreMultiWordQuery(queryWords, name);
    if (
      multiResult.matchType < best.matchType ||
      (multiResult.matchType === best.matchType &&
        multiResult.score > best.score)
    ) {
      best = multiResult;
    }
  }

  return best;
}

/**
 * Search stations with fuzzy matching and ranking
 * Sorts by: match type (exact/prefix > contains > fuzzy), then importance, then score
 */
export function fuzzySearch(
  stations: Station[],
  query: string,
  limit: number = 20,
): Station[] {
  if (!query.trim()) {
    // When no query, sort by importance (lower number = more important)
    return stations
      .slice()
      .sort((a, b) => a.importance - b.importance)
      .slice(0, limit);
  }

  const scored = stations
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
      // First: match type (exact/prefix matches first)
      if (a.matchType !== b.matchType) {
        return a.matchType - b.matchType;
      }
      // Second: importance (lower number = more important)
      if (a.station.importance !== b.station.importance) {
        return a.station.importance - b.station.importance;
      }
      // Third: score within same match type
      return b.score - a.score;
    })
    .slice(0, limit);

  return scored.map(({ station }) => station);
}
