import Image from "next/image";

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
  // Other
  obb: "obb",
  sncf: "sncf",
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
};

function getBrandPath(brand: string): string | null {
  const normalized = brand.toLowerCase();
  const resolved = brandAliases[normalized] ?? normalized;
  return brandPaths[resolved] ?? null;
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
