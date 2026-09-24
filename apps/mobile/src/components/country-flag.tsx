import { getCountry, type CountryCode } from "@repo/data/countries";
import type { FC } from "react";
import { View } from "react-native";
import type { SvgProps } from "react-native-svg";

// The web app's flags, compiled into native SVG components at build time.
import be from "../../../web/public/assets/flags/be.svg";
import ch from "../../../web/public/assets/flags/ch.svg";
import de from "../../../web/public/assets/flags/de.svg";
import dk from "../../../web/public/assets/flags/dk.svg";
import fi from "../../../web/public/assets/flags/fi.svg";
import fr from "../../../web/public/assets/flags/fr.svg";
import ie from "../../../web/public/assets/flags/ie.svg";
import it from "../../../web/public/assets/flags/it.svg";
import lu from "../../../web/public/assets/flags/lu.svg";
import nl from "../../../web/public/assets/flags/nl.svg";
import no from "../../../web/public/assets/flags/no.svg";
import pl from "../../../web/public/assets/flags/pl.svg";
import se from "../../../web/public/assets/flags/se.svg";
import uk from "../../../web/public/assets/flags/uk.svg";

const flags: Record<CountryCode, FC<SvgProps>> = {
  be,
  ch,
  de,
  dk,
  fi,
  fr,
  ie,
  it,
  lu,
  nl,
  no,
  pl,
  se,
  uk,
};

export function CountryFlag({ stationId, size = 14 }: { stationId: string; size?: number }) {
  const code = getCountry(stationId);
  if (!code) return null;

  const Flag = flags[code];
  return (
    <View
      accessibilityLabel={getCountry(stationId, { format: "name" }) ?? undefined}
      style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}
    >
      <Flag width={size} height={size} />
    </View>
  );
}
