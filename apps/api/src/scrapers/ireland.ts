import type { Train } from "@repo/data";

import type { ScrapeResult } from "./index";
import { ScraperError } from "./index";
import { fetchWithTimeout } from "./fetch";
import ieStationCodes from "./codes/ie-codes.json";

const IE_BASE_URL =
  "http://api.irishrail.ie/realtime/realtime.asmx/getStationDataByCodeXML_WithNumMins";

// Static numeric ID → station code mapping
const stationCodes = ieStationCodes as Record<string, string>;

function buildUrl(stationId: string, numMins = 90): string {
  const numericId = stationId.replace(/^[A-Z]+/, "");
  const code = stationCodes[numericId];
  if (!code) {
    throw new ScraperError(`Unknown Irish station ID: ${stationId}`, 400);
  }
  return `${IE_BASE_URL}?StationCode=${code}&NumMins=${numMins}`;
}

// State class to manage parsing state across HTMLRewriter handlers
class ParserState {
  trains: Train[] = [];
  type: "arrivals" | "departures";

  // Current train being parsed
  currentTrain: Partial<Train> = {};
  currentTag = "";
  currentText = "";

  // Fields from XML
  origin = "";
  destination = "";
  scharrival = "";
  schdepart = "";
  late = "";
  status = "";
  traintype = "";
  locationtype = "";
  duein = "";

  constructor(type: "arrivals" | "departures") {
    this.type = type;
  }

  processTag(): void {
    const text = this.currentText.trim();
    const tag = this.currentTag.toLowerCase();

    switch (tag) {
      case "traincode":
        this.currentTrain.trainNumber = text;
        break;
      case "origin":
        this.origin = text;
        break;
      case "destination":
        this.destination = text;
        break;
      case "scharrival":
        this.scharrival = text;
        break;
      case "schdepart":
        this.schdepart = text;
        break;
      case "late":
        this.late = text;
        break;
      case "status":
        this.status = text;
        break;
      case "traintype":
        this.traintype = text;
        break;
      case "locationtype":
        this.locationtype = text;
        break;
      case "duein":
        this.duein = text;
        break;
    }
  }

  finalizeRecord(): void {
    // Process any pending tag
    if (this.currentTag) {
      this.processTag();
      this.currentTag = "";
    }

    if (!this.currentTrain.trainNumber) return;

    // Filter by locationtype: O=origin, D=destination, S=stop (through)
    // Departures: show O (originates here) and S (passes through)
    // Arrivals: show D (terminates here) and S (passes through)
    if (this.type === "departures" && this.locationtype === "D") return;
    if (this.type === "arrivals" && this.locationtype === "O") return;

    // Determine scheduled time based on arrivals/departures
    // "00:00" means not applicable (origin has no arrival, destination has no departure)
    const scheduledTime =
      this.type === "arrivals"
        ? this.scharrival !== "00:00"
          ? this.scharrival
          : this.schdepart
        : this.schdepart !== "00:00"
          ? this.schdepart
          : this.scharrival;

    // Parse delay - can be negative (early), 0, or positive
    const lateNum = parseInt(this.late, 10);
    const delay = isNaN(lateNum) ? null : lateNum;

    // Map status — only show incoming/departing if train is due within 5 minutes
    let trainStatus: Train["status"] = null;
    const dueinMin = parseInt(this.duein, 10);
    const statusLower = this.status.toLowerCase();
    if (statusLower === "en route" || statusLower === "arriving") {
      if (!isNaN(dueinMin) && dueinMin <= 5) {
        trainStatus = this.type === "arrivals" ? "incoming" : "departing";
      }
    }

    // Map train type to category
    const category = this.traintype === "Train" ? "Intercity" : this.traintype;

    const train: Train = {
      brand: "IR",
      category: category || null,
      trainNumber: this.currentTrain.trainNumber,
      ...(this.type === "departures" ? { destination: this.destination } : { origin: this.origin }),
      scheduledTime: scheduledTime || "--:--",
      delay,
      platform: null,
      status: trainStatus,
      info: null,
    };

    this.trains.push(train);

    // Reset for next record
    this.currentTrain = {};
    this.origin = "";
    this.destination = "";
    this.scharrival = "";
    this.schdepart = "";
    this.late = "";
    this.status = "";
    this.traintype = "";
    this.locationtype = "";
    this.duein = "";
  }
}

export async function scrapeIrelandTrains(
  stationId: string,
  type: "arrivals" | "departures" = "departures",
): Promise<ScrapeResult> {
  const url = buildUrl(stationId);
  const { response, fetchMs } = await fetchWithTimeout(url, "Irish");

  const state = new ParserState(type);

  const TAGS = [
    "traincode",
    "origin",
    "destination",
    "scharrival",
    "schdepart",
    "late",
    "status",
    "traintype",
    "locationtype",
    "duein",
  ];

  const rewriter = new HTMLRewriter();

  // Handle each train record boundary
  rewriter.on("objstationdata", {
    element() {
      // Finalize previous record if any
      if (state.currentTrain.trainNumber) {
        state.finalizeRecord();
      }
      state.currentTrain = {};
      state.currentTag = "";
      state.currentText = "";
    },
  });

  // Handle each XML tag we care about
  for (const tag of TAGS) {
    rewriter.on(tag, {
      element() {
        // Process previous tag before starting new one
        if (state.currentTag) {
          state.processTag();
        }
        state.currentTag = tag;
        state.currentText = "";
      },
      text(chunk) {
        state.currentText += chunk.text;
      },
    });
  }

  // Consume the transformed response to trigger parsing
  await rewriter.transform(response).text();

  // Finalize the last record
  if (state.currentTrain.trainNumber) {
    state.finalizeRecord();
  }

  // Sort by scheduled time and limit to 16
  state.trains.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  const filtered = state.trains.slice(0, 16);

  return {
    trains: filtered,
    info: null,
    timing: { fetchMs },
  };
}
