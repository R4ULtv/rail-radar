// Some boards, like Italy's, send everything in capitals: "TORINO PORTA NUOVA". Shown as is, it
// reads as shouting and is slower to scan, so scrapers put it back in the case people write it in.
// Text that already has lowercase letters is left alone.

const UPPERCASE_LETTER_REGEX = /\p{Lu}/u;
const LOWERCASE_LETTER_REGEX = /\p{Ll}/u;
const FIRST_LETTER_REGEX = /\p{L}/u;
const NOT_LETTER_OR_DIGIT_REGEX = /[^\p{L}\p{N}]/gu;
const APOSTROPHE_REGEX = /['’]/;
const WHITESPACE_REGEX = /\s+/g;
const SPACE_BEFORE_PUNCTUATION_REGEX = /\s+([.,;:!?])/g;
// Between the words of a name, kept as they are: spaces, commas, hyphens, slashes and brackets.
const NAME_SEPARATOR_REGEX = /([\s,\-/()]+)/;
// After these, a name's word starts a new name: "Rho Fiera (10:14) - Di Vittorio".
const NAME_START_REGEX = /[,\-/(]/;
const SENTENCE_END_REGEX = /[.!?]$/;

/** Kept in capitals: "Firenze SMN", "Basel SBB", "Zürich HB". */
const ACRONYMS = new Set([
  "av",
  "ec",
  "en",
  "fa",
  "fb",
  "fn",
  "fr",
  "fs",
  "hb",
  "ic",
  "icn",
  "rfi",
  "rv",
  "sbb",
  "smn",
  "tgv",
  "tper",
]);
/** Joining words, lowercase inside a name: "Reggio di Calabria", "Ponte d'Adda". */
const PARTICLES = new Set([
  "a",
  "al",
  "am",
  "an",
  "d",
  "da",
  "dal",
  "de",
  "dei",
  "del",
  "della",
  "delle",
  "der",
  "di",
  "du",
  "e",
  "im",
  "in",
  "la",
  "le",
  "les",
  "sul",
  "sulla",
  "sur",
]);
/** Names that keep their capital inside a sentence. */
const PROPER_NAMES = new Set([
  "eurocity",
  "frecciabianca",
  "frecciargento",
  "frecciarossa",
  "intercity",
  "italo",
  "trenitalia",
  "trenord",
]);

function isAllCaps(text: string): boolean {
  return UPPERCASE_LETTER_REGEX.test(text) && !LOWERCASE_LETTER_REGEX.test(text);
}

function tidy(text: string): string {
  return text.replace(WHITESPACE_REGEX, " ").replace(SPACE_BEFORE_PUNCTUATION_REGEX, "$1").trim();
}

function bare(word: string): string {
  return word.replace(NOT_LETTER_OR_DIGIT_REGEX, "");
}

/** The first letter in capitals, after any quote or bracket before it. */
function capitalize(word: string): string {
  return word.replace(FIRST_LETTER_REGEX, (letter) => letter.toUpperCase());
}

/** "S.LUCIA" is "S.Lucia", but "C.LE" is "C.le": a short ending is an abbreviation's. */
function capitalizeAfterDots(word: string): string {
  const parts = word.split(".");
  return parts
    .map((part, index) =>
      index > 0 && index === parts.length - 1 && part.length <= 2 ? part : capitalize(part),
    )
    .join(".");
}

/** One word of a name, already lowercase. */
function formatNameWord(word: string, startsName: boolean): string {
  const letters = bare(word);
  if (ACRONYMS.has(letters)) return word.toUpperCase();
  if (!startsName && PARTICLES.has(letters)) return word;
  // "D'ADDA" is "d'Adda", "SANT'ANTIMO" is "Sant'Antimo".
  const apostrophe = word.search(APOSTROPHE_REGEX);
  if (apostrophe > 0 && apostrophe < word.length - 1) {
    const before = word.slice(0, apostrophe);
    const after = word.slice(apostrophe + 1);
    const formattedBefore = startsName || !PARTICLES.has(before) ? capitalize(before) : before;
    return `${formattedBefore}${word[apostrophe]}${capitalizeAfterDots(capitalize(after))}`;
  }
  return capitalizeAfterDots(capitalize(word));
}

/**
 * Place names, or a list of them like a train's stops: "TORINO P. SUSA (10:53)" as
 * "Torino P. Susa (10:53)".
 */
export function formatPlaceNames(text: string): string {
  if (!isAllCaps(text)) return text;
  const parts = tidy(text).toLowerCase().split(NAME_SEPARATOR_REGEX);
  return parts
    .map((part, index) =>
      index % 2 === 1
        ? part
        : formatNameWord(part, index === 0 || NAME_START_REGEX.test(parts[index - 1]!)),
    )
    .join("");
}

/** A notice: "LAVORI SULLA LINEA. INFO IN STAZIONE" as "Lavori sulla linea. Info in stazione". */
export function formatNotice(text: string): string {
  if (!isAllCaps(text)) return text;
  let startsSentence = true;
  return tidy(text)
    .toLowerCase()
    .split(" ")
    .map((word) => {
      const letters = bare(word);
      let formatted = word;
      if (ACRONYMS.has(letters)) formatted = word.toUpperCase();
      else if (startsSentence || PROPER_NAMES.has(letters)) formatted = capitalize(word);
      startsSentence = SENTENCE_END_REGEX.test(word);
      return formatted;
    })
    .join(" ");
}
