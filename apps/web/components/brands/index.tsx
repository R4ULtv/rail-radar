import type { ComponentType, SVGProps } from "react";

import Trenord from "./trenord";
import Italo from "./italo";
import Trenitalia from "./trenitalia";
import Tper from "./tper";
import InterCity from "./intercity";
import FrecciaRossa from "./frecciarossa";
import InterCityNotte from "./intercity-notte";
import Sncf from "./sncf";
import Sad from "./sad";
import Obb from "./obb";
import Bls from "./bls";
import Tua from "./tua";

type BrandIconProps = SVGProps<SVGSVGElement>;

const brandIcons: Record<string, ComponentType<BrandIconProps>> = {
  trenitalia: Trenitalia,
  intercity: InterCity,
  "intercity notte": InterCityNotte,
  // High-speed
  italo: Italo,
  ntv: Italo,
  frecciarossa: FrecciaRossa,
  frecciabianca: Trenitalia,
  frecciargento: Trenitalia,
  // Regional
  trenord: Trenord, // Lombardia
  "trenitalia tper": Tper, // Emilia-Romagna
  sad: Sad, // Trentino
  tua: Tua, // Abruzzo
  fse: Trenitalia, // Puglia
  "leonardo express": Trenitalia,
  // Other
  sncf: Sncf, // France
  obb: Obb, // Austria
  "obb railjet": Obb,
  "obb nightjet": Obb,
  bls: Bls, // Switzerland
};

interface BrandLogoProps extends BrandIconProps {
  brand: string | null;
}

export function BrandLogo({ brand, ...props }: BrandLogoProps) {
  if (!brand) return null;
  const Icon = brandIcons[brand.toLowerCase()];
  if (!Icon) return null;
  return <Icon {...props} />;
}
