import type { ComponentType, SVGProps } from "react";

import Trenord from "./trenord";
import Italo from "./italo";
import Trenitalia from "./trenitalia";
import Tper from "./tper";
import InterCity from "./intercity";
import FrecciaRossa from "./frecciarossa";
import InterCityNotte from "./intercity-notte";

type BrandIconProps = SVGProps<SVGSVGElement>;

const brandIcons: Record<string, ComponentType<BrandIconProps>> = {
  trenord: Trenord,
  italo: Italo,
  ntv: Italo,
  trenitalia: Trenitalia,
  frecciarossa: FrecciaRossa,
  frecciabianca: Trenitalia,
  frecciargento: Trenitalia,
  fse: Trenitalia,
  "trenitalia tper": Tper,
  intercity: InterCity,
  "intercity notte": InterCityNotte,
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
