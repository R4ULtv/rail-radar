import type { StationInfobox, StationStatus } from "../types/wikipedia";

/**
 * Parse MediaWiki wikitext to extract station infobox data
 */
export function parseStationInfobox(wikitext: string): StationInfobox | null {
  // Find the station infobox template
  const infoboxMatch = findInfoboxTemplate(wikitext);
  if (!infoboxMatch) {
    return null;
  }

  const fields = parseTemplateFields(infoboxMatch);
  const infobox = mapFieldsToInfobox(fields, wikitext);

  // Infer status if not explicitly set
  if (!infobox.stato) {
    infobox.stato = inferStationStatus(wikitext);
  }

  return infobox;
}

/**
 * Find the {{Stazione ferroviaria}} or similar template in wikitext
 */
function findInfoboxTemplate(wikitext: string): string | null {
  // Match various station infobox template names
  const templatePatterns = [
    /\{\{Stazione ferroviaria\s*\n([\s\S]*?)\n\}\}/i,
    /\{\{Infobox stazione ferroviaria\s*\n([\s\S]*?)\n\}\}/i,
    /\{\{Fermata ferroviaria\s*\n([\s\S]*?)\n\}\}/i,
  ];

  for (const pattern of templatePatterns) {
    const match = wikitext.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  // Fallback: try to find any template with station-related fields
  const genericMatch = wikitext.match(
    /\{\{[^{}]*(?:stazione|fermata)[^{}]*\n([\s\S]*?)\n\}\}/i,
  );
  return genericMatch?.[1] ?? null;
}

/**
 * Parse template fields from wikitext format: | field = value
 */
function parseTemplateFields(templateContent: string): Map<string, string> {
  const fields = new Map<string, string>();

  const lines = templateContent.split("\n");
  let currentField = "";
  let currentValue = "";

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("|")) {
      if (currentField) {
        fields.set(currentField.toLowerCase(), cleanWikitext(currentValue));
      }

      const fieldMatch = trimmed.match(/^\|\s*([^=]+?)\s*=\s*(.*)/);
      if (fieldMatch) {
        currentField = fieldMatch[1]?.trim() ?? "";
        currentValue = fieldMatch[2] ?? "";
      } else {
        currentField = "";
        currentValue = "";
      }
    } else if (currentField) {
      currentValue += " " + trimmed;
    }
  }

  if (currentField) {
    fields.set(currentField.toLowerCase(), cleanWikitext(currentValue));
  }

  return fields;
}

/**
 * Clean wikitext markup from a string
 */
function cleanWikitext(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");
  cleaned = cleaned.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  cleaned = cleaned.replace(/<ref[^>]*\/>/gi, "");
  cleaned = cleaned.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2");
  cleaned = cleaned.replace(/\[\[([^\]]*)\]\]/g, "$1");
  cleaned = cleaned.replace(/\[https?:\/\/[^\s\]]+ ([^\]]+)\]/g, "$1");
  cleaned = cleaned.replace(/\[https?:\/\/[^\]]+\]/g, "");
  cleaned = cleaned.replace(/'{2,5}/g, "");
  cleaned = cleaned.replace(/\{\{nowrap\|([^}]*)\}\}/gi, "$1");
  cleaned = cleaned.replace(/&nbsp;/g, " ");
  cleaned = cleaned.replace(/<small>([^<]*)<\/small>/gi, "$1");
  cleaned = cleaned.replace(/<br\s*\/?>/gi, ", ");
  cleaned = cleaned.replace(/\{\{[^{}]*\}\}/g, "");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned;
}

/**
 * Extract coordinates from wikitext using {{Coord}} template
 */
export function extractCoordinates(
  wikitext: string,
): { lat: number; lng: number } | undefined {
  // Simple decimal format: {{Coord|45.123|12.456|...}}
  const decimalMatch = wikitext.match(
    /\{\{[Cc]oord\|(-?\d+\.?\d*)\|(-?\d+\.?\d*)\|/,
  );
  if (decimalMatch) {
    const lat = parseFloat(decimalMatch[1]!);
    const lng = parseFloat(decimalMatch[2]!);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  // DMS format: {{Coord|45|7|22|N|12|27|34|E|...}}
  const dmsMatch = wikitext.match(
    /\{\{[Cc]oord\|(\d+)\|(\d+)\|(\d+\.?\d*)\|([NS])\|(\d+)\|(\d+)\|(\d+\.?\d*)\|([EW])/,
  );
  if (dmsMatch) {
    const latD = parseInt(dmsMatch[1]!, 10);
    const latM = parseInt(dmsMatch[2]!, 10);
    const latS = parseFloat(dmsMatch[3]!);
    const latDir = dmsMatch[4];
    const lngD = parseInt(dmsMatch[5]!, 10);
    const lngM = parseInt(dmsMatch[6]!, 10);
    const lngS = parseFloat(dmsMatch[7]!);
    const lngDir = dmsMatch[8];

    let lat = latD + latM / 60 + latS / 3600;
    let lng = lngD + lngM / 60 + lngS / 3600;

    if (latDir === "S") lat = -lat;
    if (lngDir === "W") lng = -lng;

    return { lat, lng };
  }

  // DM format (no seconds): {{Coord|45|7.5|N|12|27.5|E|...}}
  const dmMatch = wikitext.match(
    /\{\{[Cc]oord\|(\d+)\|(\d+\.?\d*)\|([NS])\|(\d+)\|(\d+\.?\d*)\|([EW])/,
  );
  if (dmMatch) {
    const latD = parseInt(dmMatch[1]!, 10);
    const latM = parseFloat(dmMatch[2]!);
    const latDir = dmMatch[3];
    const lngD = parseInt(dmMatch[4]!, 10);
    const lngM = parseFloat(dmMatch[5]!);
    const lngDir = dmMatch[6];

    let lat = latD + latM / 60;
    let lng = lngD + lngM / 60;

    if (latDir === "S") lat = -lat;
    if (lngDir === "W") lng = -lng;

    return { lat, lng };
  }

  return undefined;
}

/**
 * Map parsed fields to StationInfobox structure
 */
function mapFieldsToInfobox(
  fields: Map<string, string>,
  wikitext: string,
): StationInfobox {
  const infobox: StationInfobox = {};

  // Coordinates from wikitext
  const coordinates = extractCoordinates(wikitext);
  if (coordinates) {
    infobox.coordinates = coordinates;
  }

  // Status - check multiple field names
  const stato =
    fields.get("stato") || fields.get("status") || fields.get("stato attuale");
  if (stato) {
    infobox.stato = stato;
  }

  return infobox;
}

/**
 * Infer station status from article content when not explicitly set in infobox.
 */
function inferStationStatus(wikitext: string): string {
  const lowerText = wikitext.toLowerCase();

  if (
    lowerText.includes("stazione soppressa") ||
    lowerText.includes("è stata soppressa") ||
    lowerText.includes("venne soppressa") ||
    lowerText.includes("fu soppressa")
  ) {
    return "Soppressa";
  }

  if (
    lowerText.includes("stazione chiusa") ||
    lowerText.includes("è stata chiusa") ||
    lowerText.includes("venne chiusa") ||
    lowerText.includes("fu chiusa") ||
    lowerText.includes("stazione dismessa")
  ) {
    return "Chiusa";
  }

  if (
    lowerText.includes("== movimento ==") ||
    lowerText.includes("è servita da treni") ||
    lowerText.includes("trenitalia") ||
    lowerText.includes("trenord") ||
    lowerText.includes("italo")
  ) {
    return "Attiva";
  }

  if (lowerText.includes("== interscambi ==")) {
    return "Attiva";
  }

  return "Attiva";
}

/**
 * Determine the station status category
 */
export function getStationStatus(stato?: string): StationStatus {
  if (!stato) return "unknown";

  const normalized = stato.toLowerCase().trim();

  if (
    normalized.includes("soppress") ||
    normalized.includes("dismess") ||
    normalized.includes("non in uso") ||
    normalized.includes("fuori uso")
  ) {
    return "soppressa";
  }

  if (normalized.includes("attiv") || normalized.includes("in uso")) {
    return "attiva";
  }

  if (normalized.includes("chius")) {
    return "chiusa";
  }

  return "unknown";
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1) {
    return "< 1 m";
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}
