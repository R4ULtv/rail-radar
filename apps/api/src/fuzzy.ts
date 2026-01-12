import type { Station } from "@repo/data";

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
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j - 1] + cost, // substitution
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j] + 1, // deletion
      );

      // Transposition
      if (
        i > 1 &&
        j > 1 &&
        b.charAt(i - 1) === a.charAt(j - 2) &&
        b.charAt(i - 2) === a.charAt(j - 1)
      ) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Score a station name against a query (0-1, higher = better match)
 */
function scoreStation(query: string, name: string): number {
  const q = query.toLowerCase();
  const n = name.toLowerCase();
  const words = n.split(/\s+/);

  // Exact match
  if (n === q) return 1.0;

  // Name starts with query
  if (n.startsWith(q)) return 0.95;

  // Any word starts with query
  if (words.some((w) => w.startsWith(q))) return 0.9;

  // Name contains query
  if (n.includes(q)) return 0.8;

  // Fuzzy match against each word, take best score
  // Only allow 1-2 mistakes max
  let bestScore = 0;
  for (const word of words) {
    // Compare query against the word (or prefix of word for long words)
    const compareWord =
      word.length > q.length + 2 ? word.slice(0, q.length + 2) : word;
    const distance = damerauLevenshtein(q, compareWord);

    // Max 2 edits allowed, scale by query length
    const maxAllowedDistance = Math.min(2, Math.floor(q.length / 2));
    if (distance > maxAllowedDistance) {
      continue;
    }

    const maxLen = Math.max(q.length, compareWord.length);
    let similarity = maxLen > 0 ? 1 - distance / maxLen : 0;

    // Boost score if first letter matches (common typo pattern)
    if (q.length > 0 && word.length > 0 && q[0] === word[0]) {
      similarity = similarity * 0.8 + 0.2;
    }

    if (similarity > bestScore) {
      bestScore = similarity;
    }
  }

  // Scale fuzzy matches below exact/prefix matches
  return bestScore * 0.75;
}

/**
 * Search stations with fuzzy matching and ranking
 */
export function fuzzySearch(
  stations: Station[],
  query: string,
  limit: number = 20,
): Station[] {
  if (!query.trim()) {
    return stations.slice(0, limit);
  }

  const scored = stations
    .map((station) => ({ station, score: scoreStation(query, station.name) }))
    .filter(({ score }) => score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ station }) => station);
}
