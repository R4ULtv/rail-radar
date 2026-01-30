import type { Train } from "@repo/data";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class ScraperError extends Error {
  constructor(
    message: string,
    public statusCode: ContentfulStatusCode,
  ) {
    super(message);
    this.name = "ScraperError";
  }
}

const BASE_URL =
  "https://iechub.rfi.it/ArriviPartenze/en/ArrivalsDepartures/Monitor";

function buildUrl(stationId: number, arrivals: boolean): string {
  if (arrivals) {
    return `${BASE_URL}?placeId=${stationId}&arrivals=True`;
  }
  return `${BASE_URL}?Arrivals=False&Search=&PlaceId=${stationId}`;
}

interface DelayResult {
  delay: number | null;
  cancelled: boolean;
}

function parseDelay(text: string): DelayResult {
  const trimmed = text.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "on time") {
    return { delay: 0, cancelled: false };
  }
  if (trimmed.toLowerCase() === "cancelled") {
    return { delay: null, cancelled: true };
  }
  const num = parseInt(trimmed, 10);
  return { delay: isNaN(num) ? null : num, cancelled: false };
}

function parseCategory(text: string | null): string | null {
  if (!text) return null;
  return (
    text
      .replace(/^Categoria\s+/i, "")
      .replace(/&#?\w+;/g, "") // Remove HTML entities like &#39; &nbsp; etc.
      .trim() || null
  );
}

function parseInfo(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/STOPS AT:\s*(.+)/i);
  if (match?.[1]) {
    return match[1].trim();
  }
  return trimmed || null;
}

export interface ScrapeResult {
  trains: Train[];
  info: string | null;
}

// State class to manage parsing state across HTMLRewriter handlers
class ParserState {
  trains: Train[] = [];
  stationInfo = "";
  type: "arrivals" | "departures";

  // Row parsing state
  inTbody = false;
  currentTrain: Partial<Train & { cancelled: boolean }> = {};
  cellIndex = -1;
  cellText = "";
  cellImgAlts: string[] = [];
  cellImgSrc = "";
  cellInfoText = ""; // Text from .testoinfoaggiuntive

  constructor(type: "arrivals" | "departures") {
    this.type = type;
  }

  processCellData(): void {
    const text = this.cellText.trim();
    const imgAlts = this.cellImgAlts;
    const imgSrc = this.cellImgSrc;
    const train = this.currentTrain;

    switch (this.cellIndex) {
      case 0: // Brand (from img alt)
        train.brand = imgAlts[0] || null;
        break;
      case 1: {
        // Category (from img alt or text)
        const rawCat = imgAlts[0] || text;
        train.category = parseCategory(rawCat);
        break;
      }
      case 2: // Train number
        train.trainNumber = text;
        break;
      case 3: // Origin/Destination
        if (this.type === "departures") {
          train.destination = text;
        } else {
          train.origin = text;
        }
        break;
      case 4: // Scheduled time
        train.scheduledTime = text;
        break;
      case 5: {
        // Delay
        const delayResult = parseDelay(text);
        train.delay = delayResult.delay;
        train.cancelled = delayResult.cancelled;
        break;
      }
      case 6: // Platform
        train.platform = text || null;
        break;
      case 7: // Status (from img src - check for Lampeggio)
        if (
          imgSrc.includes("LampeggioGold") ||
          imgSrc.includes("LampeggioGrey")
        ) {
          train.status = this.type === "arrivals" ? "incoming" : "departing";
        }
        break;
      case 8: // Info (from .testoinfoaggiuntive div)
        train.info = parseInfo(this.cellInfoText);
        break;
    }
  }

  finalizeRow(): void {
    // Process the last cell if we have one
    if (this.cellIndex >= 0) {
      this.processCellData();
    }

    // Only add if we have a train number
    if (this.currentTrain.trainNumber) {
      // Check if info contains "CANCELLATO" and update status accordingly
      let isCancelled = this.currentTrain.cancelled ?? false;
      const info = this.currentTrain.info ?? null;
      if (info && info.toUpperCase().includes("CANCELLATO")) {
        isCancelled = true;
      }

      const train: Train = {
        brand: this.currentTrain.brand ?? null,
        category: this.currentTrain.category ?? null,
        trainNumber: this.currentTrain.trainNumber,
        ...(this.type === "departures"
          ? { destination: this.currentTrain.destination ?? "" }
          : { origin: this.currentTrain.origin ?? "" }),
        scheduledTime: this.currentTrain.scheduledTime ?? "",
        delay: this.currentTrain.delay ?? null,
        platform: this.currentTrain.platform ?? null,
        status: isCancelled ? "cancelled" : (this.currentTrain.status ?? null),
        info: info,
      };
      this.trains.push(train);
    }

    // Reset for next row
    this.currentTrain = {};
    this.cellIndex = -1;
    this.cellText = "";
    this.cellImgAlts = [];
    this.cellImgSrc = "";
    this.cellInfoText = "";
  }

  startNewCell(): void {
    // Process previous cell if we have one
    if (this.cellIndex >= 0) {
      this.processCellData();
    }
    this.cellIndex++;
    this.cellText = "";
    this.cellImgAlts = [];
    this.cellImgSrc = "";
    this.cellInfoText = "";
  }
}

export async function scrapeTrains(
  stationId: number,
  type: "arrivals" | "departures" = "departures",
): Promise<ScrapeResult> {
  const url = buildUrl(stationId, type === "arrivals");

  const response = await fetch(url);
  if (!response.ok) {
    throw new ScraperError(
      response.statusText || `HTTP ${response.status}`,
      response.status as ContentfulStatusCode,
    );
  }

  const state = new ParserState(type);

  const rewriter = new HTMLRewriter()
    .on("table tbody", {
      element() {
        state.inTbody = true;
      },
    })
    .on("table tbody tr", {
      element() {
        // Finalize previous row when starting a new one
        if (state.cellIndex >= 0) {
          state.finalizeRow();
        }
        state.currentTrain = {};
        state.cellIndex = -1;
        state.cellText = "";
        state.cellImgAlts = [];
        state.cellImgSrc = "";
      },
    })
    .on("table tbody tr td", {
      element() {
        state.startNewCell();
      },
      text(chunk) {
        state.cellText += chunk.text;
      },
    })
    .on("table tbody tr td img", {
      element(el) {
        const alt = el.getAttribute("alt");
        if (alt) state.cellImgAlts.push(alt);
        const src = el.getAttribute("src");
        if (src) state.cellImgSrc = src;
      },
    })
    .on("table tbody tr td .testoinfoaggiuntive", {
      text(chunk) {
        state.cellInfoText += chunk.text;
      },
    })
    .on(".barrainfostazione .marqueeinfosupp", {
      text(chunk) {
        state.stationInfo += chunk.text;
      },
    });

  // Consume the transformed response to trigger parsing
  await rewriter.transform(response).text();

  // Finalize the last row
  if (state.cellIndex >= 0) {
    state.finalizeRow();
  }

  return {
    trains: state.trains,
    info: state.stationInfo.trim() || null,
  };
}
