import Image from "next/image";
import { brandBySlug } from "@repo/data";

// Maps brand names to their SVG file paths (relative to /brands/)
const brandPaths: Record<string, string> = {
  // Italian brands
  trenitalia: "it/trenitalia",
  intercity: "it/intercity",
  "intercity notte": "it/intercity_notte",
  italo: "it/italo",
  frecciarossa: "it/frecciarossa",
  trenord: "it/trenord",
  "trenitalia tper": "it/tper",
  sad: "it/sad",
  tua: "it/tua",
  // Swiss brands
  bls: "ch/bls",
  sbb: "ch/sbb",
  sob: "ch/sob",
  szu: "ch/szu",
  rbs: "ch/rbs",
  tpf: "ch/tpf",
  zb: "ch/zb",
  ab: "ch/ab",
  thurbo: "ch/thurbo",
  tpc: "ch/tpc",
  tmr: "ch/tmr",
  mgb: "ch/mgb",
  ra: "ch/ra",
  rhb: "ch/rhb",
  mob: "ch/mob",
  flp: "ch/flp",
  // Other
  obb: "obb",
  sncf: "sncf",
  vr: "vr",
  sncb: "sncb",
  eurostar: "eurostar",
  db: "db",
  ns: "ns",
  // UK brands
  lm: "uk/lm",
  nt: "uk/nt",
  gw: "uk/gw",
  xc: "uk/xc",
  sr: "uk/sr",
  em: "uk/em",
  se: "uk/se",
  sw: "uk/sw",
  sn: "uk/sn",
  le: "uk/le",
  gr: "uk/gr",
  xr: "uk/xr",
  tl: "uk/tl",
  ch: "uk/ch",
  vt: "uk/vt",
  aw: "uk/aw",
  tp: "uk/tp",
  lo: "uk/lo",
  cc: "uk/cc",
  cs: "uk/cs",
  gc: "uk/gc",
  ht: "uk/ht",
  // Irish brands
  ir: "ir",
};

// Aliases for brands that share icons
const brandAliases: Record<string, string> = {
  ntv: "italo",
  frecciabianca: "trenitalia",
  frecciargento: "trenitalia",
  fse: "trenitalia",
  "leonardo express": "trenitalia",
  "obb railjet": "obb",
  "obb nightjet": "obb",
  "sbb gmbh": "sbb",
  es: "eurostar",
  gn: "tl",
  gx: "sn",
  ln: "lm",
  wm: "lm",
};

function getBrandPath(brand: string): string | null {
  const normalized = brand.toLowerCase();
  const resolved = brandAliases[normalized] ?? normalized;
  return brandPaths[resolved] ?? null;
}

// Maps raw brand names (lowercased) to brand slugs
const brandSlugMap: Record<string, string> = {
  trenitalia: "trenitalia",
  italo: "italo",
  ntv: "italo",
  frecciarossa: "frecciarossa",
  frecciabianca: "trenitalia",
  frecciargento: "trenitalia",
  intercity: "intercity",
  "intercity notte": "intercity-notte",
  trenord: "trenord",
  "trenitalia tper": "trenitalia-tper",
  sad: "sad",
  tua: "tua",
  fse: "trenitalia",
  "leonardo express": "trenitalia",
  bls: "bls",
  sbb: "sbb",
  "sbb gmbh": "sbb",
  sob: "sob",
  szu: "szu",
  rbs: "rbs",
  tpf: "tpf",
  zb: "zb",
  ab: "ab",
  thurbo: "thurbo",
  tpc: "tpc",
  tmr: "tmr",
  mgb: "mgb",
  ra: "ra",
  rhb: "rhb",
  mob: "mob",
  flp: "flp",
  obb: "obb",
  "obb railjet": "obb",
  "obb nightjet": "obb",
  sncf: "sncf",
  vr: "vr",
  sncb: "sncb",
  eurostar: "eurostar",
  db: "db",
  ns: "ns",
  // UK brands
  lm: "west-midlands-trains",
  nt: "northern",
  gw: "gwr",
  xc: "crosscountry",
  sr: "scotrail",
  em: "emr",
  se: "southeastern",
  sw: "swr",
  sn: "southern",
  le: "greater-anglia",
  gr: "lner",
  xr: "elizabeth-line",
  tl: "thameslink",
  ch: "chiltern",
  vt: "avanti",
  aw: "tfw",
  tp: "transpennine",
  lo: "london-overground",
  cc: "c2c",
  // Irish brands
  ir: "ir",
};

export function getBrandSlug(brand: string): string | null {
  const normalized = brand.toLowerCase();
  const slug = brandSlugMap[normalized];
  if (slug && brandBySlug.has(slug)) return slug;
  return null;
}

interface BrandLogoProps {
  brand: string | null;
  className?: string;
}

export function BrandLogo({ brand, className }: BrandLogoProps) {
  if (!brand) return null;

  const path = getBrandPath(brand);
  if (!path) return null;

  return (
    <Image
      unoptimized
      src={`/brands/${path}.svg`}
      alt={brand}
      className={className}
      width={32}
      height={32}
    />
  );
}
