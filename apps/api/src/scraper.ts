import type { Train } from "@repo/data";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export interface FetchTiming {
  fetchMs: number;
}

export class ScraperError extends Error {
  constructor(
    message: string,
    public statusCode: ContentfulStatusCode,
    public timing?: FetchTiming,
  ) {
    super(message);
    this.name = "ScraperError";
  }
}

const BASE_URL = "http://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno";
const FETCH_TIMEOUT_MS = 30_000;

function buildDateTime(): string {
  const now = new Date();
  return now.toString().replace(/\s/g, "%20").replace(/\+/g, "%2B");
}

interface VTTrain {
  compNumeroTreno?: string;
  numeroTreno?: number;
  categoriaDescrizione?: string;
  compTipologiaTreno?: string;
  categoria?: string;
  codiceCliente?: number;
  origine?: string;
  destinazione?: string;
  compOrarioPartenza?: string;
  compOrarioArrivo?: string;
  ritardo?: number;
  binarioProgrammatoPartenzaDescrizione?: string;
  binarioEffettivoPartenzaDescrizione?: string;
  binarioProgrammatoArrivoDescrizione?: string;
  binarioEffettivoArrivoDescrizione?: string;
  compRitpiuInfo?: string;
  provpiuInfo?: string;
  cirpiuInfo?: boolean;
  subTitle?: string;
  inStazione?: boolean;
  nonPartito?: boolean;
}

function mapCategory(vt: VTTrain): string | null {
  return vt.categoriaDescrizione?.trim() || vt.compTipologiaTreno?.trim() || vt.categoria?.trim() || null;
}

// Map codiceCliente to operator brand names (matching BrandLogo keys)
const brandByClientCode: Record<number, string> = {
  1: "Trenitalia",       // Trenitalia AV (Frecce)
  2: "Trenitalia",       // Trenitalia Regionale
  4: "Intercity",        // Trenitalia IC
  18: "Trenitalia Tper", // TPER
  63: "Trenord",         // Trenord
  64: "OBB",             // ÖBB
};

function mapBrand(vt: VTTrain): string | null {
  const brand = vt.codiceCliente != null ? brandByClientCode[vt.codiceCliente] : undefined;
  if (brand) {
    const cat = vt.categoria?.trim() || vt.categoriaDescrizione?.trim() || "";
    // For Trenitalia AV, refine based on category
    if (vt.codiceCliente === 1) {
      if (cat === "FR") return "Frecciarossa";
      if (cat === "FA") return "Frecciargento";
      if (cat === "FB") return "Frecciabianca";
    }
    // For Trenitalia IC, distinguish notte
    if (vt.codiceCliente === 4) {
      if (cat === "ICN") return "Intercity Notte";
    }
    return brand;
  }
  return null;
}

function mapStatus(vt: VTTrain, type: "arrivals" | "departures"): Train["status"] {
  if (vt.subTitle?.toLowerCase().includes("cancellato")) return "cancelled";
  if (vt.provpiuInfo?.toLowerCase().includes("cancellato")) return "cancelled";
  if (vt.cirpiuInfo === false) return "cancelled";
  if (vt.inStazione) return type === "arrivals" ? "incoming" : "departing";
  if (vt.nonPartito === false && type === "departures") return "departing";
  return null;
}

function mapTrain(vt: VTTrain, type: "arrivals" | "departures"): Train {
  const isDeparture = type === "departures";

  const platform = isDeparture
    ? (vt.binarioEffettivoPartenzaDescrizione?.trim() || vt.binarioProgrammatoPartenzaDescrizione?.trim() || null)
    : (vt.binarioEffettivoArrivoDescrizione?.trim() || vt.binarioProgrammatoArrivoDescrizione?.trim() || null);

  const scheduledTime = isDeparture
    ? (vt.compOrarioPartenza?.trim() ?? "")
    : (vt.compOrarioArrivo?.trim() ?? "");

  const train: Train = {
    brand: mapBrand(vt),
    category: mapCategory(vt),
    trainNumber: vt.compNumeroTreno?.trim() || String(vt.numeroTreno ?? ""),
    scheduledTime,
    delay: vt.ritardo ?? null,
    platform,
    status: mapStatus(vt, type),
    info: vt.compRitpiuInfo?.trim() || null,
  };

  if (isDeparture) {
    train.destination = vt.destinazione?.trim() ?? "";
  } else {
    train.origin = vt.origine?.trim() ?? "";
  }

  return train;
}

export interface FetchResult {
  trains: Train[];
  info: string | null;
  timing: {
    fetchMs: number;
  };
}

export async function fetchTrains(
  stationCode: string,
  type: "arrivals" | "departures" = "departures",
): Promise<FetchResult> {
  const endpoint = type === "arrivals" ? "arrivi" : "partenze";
  const datetime = buildDateTime();
  const url = `${BASE_URL}/${endpoint}/${stationCode}/${datetime}`;
  const startTime = performance.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    const fetchMs = performance.now() - startTime;
    clearTimeout(timeoutId);

    const err = error instanceof Error ? error : new Error(String(error));
    if (err.name === "AbortError") {
      throw new ScraperError(
        "The train data source is taking too long to respond. Please try again.",
        504,
        { fetchMs },
      );
    }
    throw new ScraperError(
      "Unable to connect to the train data source. Please try again.",
      502,
      { fetchMs },
    );
  }

  const fetchMs = performance.now() - startTime;
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new ScraperError(
      response.statusText || `HTTP ${response.status}`,
      response.status as ContentfulStatusCode,
      { fetchMs },
    );
  }

  const text = await response.text();
  if (!text.trim()) {
    return { trains: [], info: null, timing: { fetchMs } };
  }

  let vtTrains: VTTrain[];
  try {
    vtTrains = JSON.parse(text);
  } catch {
    throw new ScraperError("Invalid response from train data source.", 502, { fetchMs });
  }

  if (!Array.isArray(vtTrains)) {
    return { trains: [], info: null, timing: { fetchMs } };
  }

  const trains = vtTrains.map((vt) => mapTrain(vt, type));

  return {
    trains,
    info: null,
    timing: { fetchMs },
  };
}
