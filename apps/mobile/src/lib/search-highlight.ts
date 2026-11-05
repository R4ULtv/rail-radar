// Finds what a search query matched in a name, for the results to show it. Normalized like the
// search index (lib/station-search-index.ts): without accents or case, so "zurich" marks "Zürich".

const DIACRITICS_REGEX = /[̀-ͯ]/g;
const LETTER_OR_DIGIT_REGEX = /[\p{L}\p{N}]/u;
const WORD_SEPARATOR_REGEX = /[^\p{L}\p{N}]+/u;

export type HighlightRange = [start: number, end: number];

function normalizeChar(char: string): string {
  return char.normalize("NFD").replace(DIACRITICS_REGEX, "").toLowerCase();
}

/** The name normalized, and where each of its characters came from in the name. */
function normalizeWithSources(name: string) {
  let normalized = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let index = 0;
  for (const char of name) {
    for (const normalizedChar of normalizeChar(char)) {
      normalized += normalizedChar;
      starts.push(index);
      ends.push(index + char.length);
    }
    index += char.length;
  }
  return { normalized, starts, ends };
}

function isWordStart(text: string, position: number): boolean {
  return position === 0 || !LETTER_OR_DIGIT_REGEX.test(text[position - 1]!);
}

/** Where `part` starts a word in `text`, or -1. */
function findAtWordStart(text: string, part: string): number {
  for (let at = text.indexOf(part); at !== -1; at = text.indexOf(part, at + 1)) {
    if (isWordStart(text, at)) return at;
  }
  return -1;
}

/**
 * The parts of `name` that `query` matched, in order and without overlaps: the whole query where
 * a word starts with it, otherwise each of its words where a word starts with them, otherwise
 * the query anywhere. Empty if it doesn't match.
 */
export function getHighlightRanges(name: string, query: string): HighlightRange[] {
  const normalizedQuery = Array.from(query.trim(), normalizeChar).join("");
  if (!normalizedQuery) return [];
  const { normalized, starts, ends } = normalizeWithSources(name);

  const found: HighlightRange[] = [];
  const whole = findAtWordStart(normalized, normalizedQuery);
  if (whole !== -1) {
    found.push([whole, whole + normalizedQuery.length]);
  } else {
    const words = normalizedQuery.split(WORD_SEPARATOR_REGEX).filter(Boolean);
    for (const word of words) {
      const at = findAtWordStart(normalized, word);
      if (at !== -1) found.push([at, at + word.length]);
    }
    if (found.length === 0) {
      const at = normalized.indexOf(normalizedQuery);
      if (at !== -1) found.push([at, at + normalizedQuery.length]);
    }
  }

  // Back to the name's own characters, merging the parts that touch.
  const ranges: HighlightRange[] = [];
  for (const [start, end] of found.sort((a, b) => a[0] - b[0])) {
    const range: HighlightRange = [starts[start]!, ends[end - 1]!];
    const last = ranges[ranges.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else ranges.push(range);
  }
  return ranges;
}
