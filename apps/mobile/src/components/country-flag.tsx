import { COUNTRY_MAP, getCountry, type CountryCode } from "@repo/data/countries";
import { Image, type ImageSourcePropType } from "react-native";

// Generated from the web SVGs when Metro starts. One image replaces the SVG root,
// groups, paths and clipping view for every flag in the search and live boards.
const flags: Record<CountryCode, ImageSourcePropType> = {
  be: require("../../assets/generated/flags/be.png"),
  ch: require("../../assets/generated/flags/ch.png"),
  de: require("../../assets/generated/flags/de.png"),
  dk: require("../../assets/generated/flags/dk.png"),
  fi: require("../../assets/generated/flags/fi.png"),
  fr: require("../../assets/generated/flags/fr.png"),
  hu: require("../../assets/generated/flags/hu.png"),
  ie: require("../../assets/generated/flags/ie.png"),
  it: require("../../assets/generated/flags/it.png"),
  lu: require("../../assets/generated/flags/lu.png"),
  nl: require("../../assets/generated/flags/nl.png"),
  no: require("../../assets/generated/flags/no.png"),
  pl: require("../../assets/generated/flags/pl.png"),
  se: require("../../assets/generated/flags/se.png"),
  uk: require("../../assets/generated/flags/uk.png"),
};

/** A station's country flag, or a country's by its code. */
export function CountryFlag({
  stationId,
  country,
  size = 14,
}: {
  stationId?: string;
  country?: CountryCode | null;
  size?: number;
}) {
  const code = country ?? (stationId ? getCountry(stationId) : null);
  if (!code) return null;

  return (
    <Image
      source={flags[code]}
      accessibilityLabel={COUNTRY_MAP[code]}
      fadeDuration={0}
      style={{ width: size, height: size }}
    />
  );
}
