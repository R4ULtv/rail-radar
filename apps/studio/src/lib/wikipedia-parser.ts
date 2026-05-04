import type { StationInfobox, StationStatus } from "$lib/types/wikipedia";

export function parseStationInfobox(wikitext: string): StationInfobox | null {
  const infoboxMatch = findInfoboxTemplate(wikitext);
  if (!infoboxMatch) return null;

  const fields = parseTemplateFields(infoboxMatch);
  const infobox = mapFieldsToInfobox(fields, wikitext);
  if (!infobox.stato) infobox.stato = inferStationStatus(wikitext);

  return infobox;
}

function findInfoboxTemplate(wikitext: string): string | null {
  const templatePatterns = [
    /\{\{Stazione ferroviaria\s*\n([\s\S]*?)\n\}\}/i,
    /\{\{Infobox stazione ferroviaria\s*\n([\s\S]*?)\n\}\}/i,
    /\{\{Fermata ferroviaria\s*\n([\s\S]*?)\n\}\}/i,
  ];

  for (const pattern of templatePatterns) {
    const match = wikitext.match(pattern);
    if (match?.[1]) return match[1];
  }

  return wikitext.match(/\{\{[^{}]*(?:stazione|fermata)[^{}]*\n([\s\S]*?)\n\}\}/i)?.[1] ?? null;
}

function parseTemplateFields(templateContent: string): Map<string, string> {
  const fields = new Map<string, string>();
  let currentField = "";
  let currentValue = "";

  for (const line of templateContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|")) {
      if (currentField) fields.set(currentField.toLowerCase(), cleanWikitext(currentValue));

      const fieldMatch = trimmed.match(/^\|\s*([^=]+?)\s*=\s*(.*)/);
      currentField = fieldMatch?.[1]?.trim() ?? "";
      currentValue = fieldMatch?.[2] ?? "";
    } else if (currentField) {
      currentValue += ` ${trimmed}`;
    }
  }

  if (currentField) fields.set(currentField.toLowerCase(), cleanWikitext(currentValue));
  return fields;
}

function cleanWikitext(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/[^\s\]]+ ([^\]]+)\]/g, "$1")
    .replace(/\[https?:\/\/[^\]]+\]/g, "")
    .replace(/'{2,5}/g, "")
    .replace(/\{\{nowrap\|([^}]*)\}\}/gi, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/<small>([^<]*)<\/small>/gi, "$1")
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractCoordinates(wikitext: string): { lat: number; lng: number } | undefined {
  const decimalMatch = wikitext.match(/\{\{[Cc]oord\|(-?\d+\.?\d*)\|(-?\d+\.?\d*)\|/);
  if (decimalMatch) {
    const lat = parseFloat(decimalMatch[1]!);
    const lng = parseFloat(decimalMatch[2]!);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
  }

  const dmsMatch = wikitext.match(
    /\{\{[Cc]oord\|(\d+)\|(\d+)\|(\d+\.?\d*)\|([NS])\|(\d+)\|(\d+)\|(\d+\.?\d*)\|([EW])/,
  );
  if (dmsMatch) {
    let lat =
      parseInt(dmsMatch[1]!, 10) +
      parseInt(dmsMatch[2]!, 10) / 60 +
      parseFloat(dmsMatch[3]!) / 3600;
    let lng =
      parseInt(dmsMatch[5]!, 10) +
      parseInt(dmsMatch[6]!, 10) / 60 +
      parseFloat(dmsMatch[7]!) / 3600;
    if (dmsMatch[4] === "S") lat = -lat;
    if (dmsMatch[8] === "W") lng = -lng;
    return { lat, lng };
  }

  const dmMatch = wikitext.match(
    /\{\{[Cc]oord\|(\d+)\|(\d+\.?\d*)\|([NS])\|(\d+)\|(\d+\.?\d*)\|([EW])/,
  );
  if (dmMatch) {
    let lat = parseInt(dmMatch[1]!, 10) + parseFloat(dmMatch[2]!) / 60;
    let lng = parseInt(dmMatch[4]!, 10) + parseFloat(dmMatch[5]!) / 60;
    if (dmMatch[3] === "S") lat = -lat;
    if (dmMatch[6] === "W") lng = -lng;
    return { lat, lng };
  }

  return undefined;
}

function mapFieldsToInfobox(fields: Map<string, string>, wikitext: string): StationInfobox {
  const infobox: StationInfobox = {};
  const coordinates = extractCoordinates(wikitext);
  if (coordinates) infobox.coordinates = coordinates;

  const stato = fields.get("stato") || fields.get("status") || fields.get("stato attuale");
  if (stato) infobox.stato = stato;

  return infobox;
}

function inferStationStatus(wikitext: string): string {
  const lowerText = wikitext.toLowerCase();

  for (const pattern of [
    "stazione soppressa",
    "fermata soppressa",
    "è stata soppressa",
    "venne soppressa",
    "fu soppressa",
    "definitivamente soppressa",
    "soppressione della stazione",
    "soppressione della fermata",
    "categoria:stazioni ferroviarie soppresse",
    "|stato=soppressa",
    "|stato = soppressa",
    "stazione dismessa",
    "fermata dismessa",
    "è stata dismessa",
    "venne dismessa",
    "fu dismessa",
  ]) {
    if (lowerText.includes(pattern)) return "Soppressa";
  }

  for (const pattern of [
    "stazione chiusa",
    "fermata chiusa",
    "è stata chiusa",
    "venne chiusa",
    "fu chiusa",
    "attualmente chiusa",
    "temporaneamente chiusa",
    "chiusa al traffico",
    "chiusa al servizio",
    "|stato=chiusa",
    "|stato = chiusa",
  ]) {
    if (lowerText.includes(pattern)) return "Chiusa";
  }

  for (const pattern of [
    "stazione impresenziata",
    "fermata impresenziata",
    "|stato=impresenziata",
    "|stato = impresenziata",
  ]) {
    if (lowerText.includes(pattern)) return "Attiva (impresenziata)";
  }

  for (const pattern of [
    "== movimento ==",
    "== servizi ==",
    "== interscambi ==",
    "è servita da treni",
    "effettuano fermata",
    "fermano i treni",
    "treni regionali",
    "servizio viaggiatori",
    "|stato=attiva",
    "|stato = attiva",
    "|stato=in uso",
    "|stato = in uso",
    "trenitalia",
    "trenord",
    "italo",
    "tper",
    "ferrovie dello stato",
  ]) {
    if (lowerText.includes(pattern)) return "Attiva";
  }

  return "Sconosciuto";
}

export function getStationStatus(stato?: string): StationStatus {
  if (!stato) return "unknown";
  const normalized = stato.toLowerCase().trim();

  if (
    normalized.includes("soppress") ||
    normalized.includes("dismess") ||
    normalized.includes("non in uso") ||
    normalized.includes("fuori uso") ||
    normalized.includes("abbandonat") ||
    normalized.includes("demolit")
  ) {
    return "soppressa";
  }

  if (
    normalized.includes("chius") ||
    normalized.includes("inattiv") ||
    normalized.includes("sospeso")
  ) {
    return "chiusa";
  }

  if (
    normalized.includes("attiv") ||
    normalized.includes("in uso") ||
    normalized.includes("impresenziat") ||
    normalized.includes("funzionante") ||
    normalized.includes("operativ")
  ) {
    return "attiva";
  }

  return "unknown";
}

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function formatDistance(meters: number): string {
  if (meters < 1) return "< 1 m";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}
