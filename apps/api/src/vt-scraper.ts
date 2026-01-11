import type { VTTrain, VTRawTrain } from "@repo/data/vt";

const BASE_URL = "http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno";

// Map category codes to brand names
const CATEGORY_TO_BRAND: Record<string, string> = {
  FR: "Frecciarossa",
  FA: "Frecciargento",
  FB: "Frecciabianca",
  IC: "Intercity",
  ICN: "Intercity Notte",
  EC: "Eurocity",
  EN: "Euronight",
  REG: "Regionale",
  RV: "Regionale Veloce",
};

function formatDate(): string {
  // Format: "Sat Jan 11 2026 12:00:00 GMT+0100"
  return new Date().toString().replace(/\s\(.*\)$/, "");
}

function mapCategory(categoriaDescrizione: string): string | null {
  const cat = categoriaDescrizione.trim();
  return cat || null;
}

function mapBrand(categoriaDescrizione: string): string | null {
  const cat = categoriaDescrizione.trim();
  return CATEGORY_TO_BRAND[cat] || null;
}

function mapStatus(
  raw: VTRawTrain,
  type: "arrivals" | "departures"
): VTTrain["status"] {
  if (!raw.circolante && raw.nonPartito) {
    return "cancelled";
  }
  if (raw.inStazione) {
    return type === "departures" ? "departing" : "incoming";
  }
  return null;
}

function mapPlatform(
  raw: VTRawTrain,
  type: "arrivals" | "departures"
): string | null {
  if (type === "departures") {
    return (
      raw.binarioEffettivoPartenzaCodice ||
      raw.binarioProgrammatoPartenzaCodice ||
      null
    );
  }
  return (
    raw.binarioEffettivoArrivoCodice ||
    raw.binarioProgrammatoArrivoCodice ||
    null
  );
}

function mapToTrain(
  raw: VTRawTrain,
  type: "arrivals" | "departures"
): VTTrain {
  const train: VTTrain = {
    trainNumber: String(raw.numeroTreno),
    category: mapCategory(raw.categoriaDescrizione),
    brand: mapBrand(raw.categoriaDescrizione),
    scheduledTime:
      type === "departures"
        ? raw.compOrarioPartenza || ""
        : raw.compOrarioArrivo || "",
    delay: raw.ritardo,
    platform: mapPlatform(raw, type),
    status: mapStatus(raw, type),
  };

  if (type === "departures") {
    train.destination = raw.destinazione || undefined;
  } else {
    train.origin = raw.origine || undefined;
  }

  return train;
}

export async function fetchVTTrains(
  stationCode: string,
  type: "arrivals" | "departures"
): Promise<VTTrain[]> {
  const endpoint = type === "arrivals" ? "arrivi" : "partenze";
  const date = formatDate();
  const url = `${BASE_URL}/${endpoint}/${stationCode}/${encodeURIComponent(date)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }

  const data = (await response.json()) as VTRawTrain[];

  return data.map((raw) => mapToTrain(raw, type));
}
