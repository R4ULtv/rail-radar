import type { Train } from "@repo/data";

import { ScraperError, formatTime, type ScrapeResult } from "./index";
import { fetchWithTimeout } from "./fetch";

const ENTUR_GRAPHQL_URL = "https://api.entur.io/journey-planner/v3/graphql";
const ENTUR_CLIENT_NAME = "rail-radar";
const TRAIN_LIMIT = 16;
const NORWAY_TIMEZONE = "Europe/Oslo";

type NorwayBoardType = "arrivals" | "departures";

interface EnturGraphQLResponse {
  data?: {
    stopPlace?: {
      estimatedCalls?: EnturEstimatedCall[];
    } | null;
  };
  errors?: Array<{
    message?: string;
  }>;
}

interface EnturEstimatedCall {
  realtime: boolean;
  cancellation: boolean;
  aimedArrivalTime: string;
  expectedArrivalTime: string;
  aimedDepartureTime: string;
  expectedDepartureTime: string;
  destinationDisplay?: {
    frontText?: string | null;
  } | null;
  quay?: {
    publicCode?: string | null;
  } | null;
  serviceJourney?: {
    privateCode?: string | null;
    journeyPattern?: {
      line?: {
        publicCode?: string | null;
        authority?: {
          name?: string | null;
        } | null;
        operator?: {
          name?: string | null;
        } | null;
        transportMode?: string | null;
      } | null;
    } | null;
  } | null;
  serviceJourneyEstimatedCalls?: {
    first?: {
      quay?: {
        stopPlace?: {
          name?: string | null;
        } | null;
      } | null;
    } | null;
    last?: {
      quay?: {
        stopPlace?: {
          name?: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
}

function toEnturStopPlaceId(stationId: string): string {
  const numericPart = stationId.replace(/^[A-Z]+/, "");
  if (!numericPart) {
    throw new ScraperError("Unknown Norwegian station.", 404);
  }
  return `NSR:StopPlace:${numericPart}`;
}

function buildQuery(type: NorwayBoardType): string {
  return `query NorwayStopPlaceBoard($id: String!) {
    stopPlace(id: $id) {
      estimatedCalls(
        numberOfDepartures: ${TRAIN_LIMIT}
        arrivalDeparture: ${type}
        whiteListedModes: [rail]
      ) {
        realtime
        cancellation
        aimedArrivalTime
        expectedArrivalTime
        aimedDepartureTime
        expectedDepartureTime
        destinationDisplay {
          frontText
        }
        quay {
          publicCode
        }
        serviceJourney {
          privateCode
          journeyPattern {
            line {
              publicCode
              authority {
                name
              }
              operator {
                name
              }
              transportMode
            }
          }
        }
        serviceJourneyEstimatedCalls {
          first {
            quay {
              stopPlace {
                name
              }
            }
          }
          last {
            quay {
              stopPlace {
                name
              }
            }
          }
        }
      }
    }
  }`;
}

function getScheduledIso(call: EnturEstimatedCall, type: NorwayBoardType): string {
  return type === "departures" ? call.aimedDepartureTime : call.aimedArrivalTime;
}

function getExpectedIso(call: EnturEstimatedCall, type: NorwayBoardType): string {
  return type === "departures" ? call.expectedDepartureTime : call.expectedArrivalTime;
}

function getDelay(call: EnturEstimatedCall, type: NorwayBoardType): number | null {
  const diff = Math.round(
    (new Date(getExpectedIso(call, type)).getTime() -
      new Date(getScheduledIso(call, type)).getTime()) /
      60000,
  );
  return diff > 0 ? diff : null;
}

function getStatus(call: EnturEstimatedCall, type: NorwayBoardType): Train["status"] {
  if (call.cancellation) return "cancelled";

  const expectedTime = new Date(getExpectedIso(call, type)).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (expectedTime >= now - fiveMinutes && expectedTime <= now + fiveMinutes) {
    return type === "departures" ? "departing" : "incoming";
  }

  return null;
}

function getLineCode(call: EnturEstimatedCall): string | null {
  return call.serviceJourney?.journeyPattern?.line?.publicCode ?? null;
}

function getTrainNumber(call: EnturEstimatedCall): string {
  return call.serviceJourney?.privateCode ?? getLineCode(call) ?? "";
}

function getBrand(call: EnturEstimatedCall): string | null {
  const line = call.serviceJourney?.journeyPattern?.line;
  const rawBrand = line?.authority?.name ?? line?.operator?.name ?? null;

  switch (rawBrand?.trim().toLowerCase()) {
    case "vy":
      return "Vy";
    case "sj":
      return "SJ NORD";
    case "go-ahead norge as":
    case "go-ahead nordic as":
      return "Go-Ahead Norge";
    case "flytoget":
      return "Flytoget";
    default:
      return rawBrand;
  }
}

function getEndpointName(call: EnturEstimatedCall, type: NorwayBoardType): string | undefined {
  if (type === "departures") {
    return call.serviceJourneyEstimatedCalls?.last?.quay?.stopPlace?.name ?? undefined;
  }

  return call.serviceJourneyEstimatedCalls?.first?.quay?.stopPlace?.name ?? undefined;
}

function mapCall(call: EnturEstimatedCall, type: NorwayBoardType): Train {
  const train: Train = {
    brand: getBrand(call),
    category: getLineCode(call),
    trainNumber: getTrainNumber(call),
    scheduledTime: formatTime(getScheduledIso(call, type), NORWAY_TIMEZONE),
    delay: getDelay(call, type),
    platform: call.quay?.publicCode ?? null,
    status: getStatus(call, type),
    info: call.realtime ? null : "Scheduled data only",
  };

  if (type === "departures") {
    train.destination =
      getEndpointName(call, type) ?? call.destinationDisplay?.frontText ?? undefined;
  } else {
    train.origin = getEndpointName(call, type) ?? undefined;
  }

  return train;
}

export async function scrapeNorwayTrains(
  stationId: string,
  type: NorwayBoardType = "departures",
): Promise<ScrapeResult> {
  const { response, fetchMs } = await fetchWithTimeout(ENTUR_GRAPHQL_URL, "Norwegian", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ET-Client-Name": ENTUR_CLIENT_NAME,
    },
    body: JSON.stringify({
      query: buildQuery(type),
      variables: { id: toEnturStopPlaceId(stationId) },
    }),
  });

  const data: EnturGraphQLResponse = await response.json();

  if (data.errors?.length) {
    throw new ScraperError(data.errors[0]?.message ?? "Entur query failed.", 502, { fetchMs });
  }

  const calls = data.data?.stopPlace?.estimatedCalls;
  if (!calls) {
    throw new ScraperError("Unknown Norwegian station.", 404, { fetchMs });
  }

  return {
    trains: calls
      .filter((call) => call.serviceJourney?.journeyPattern?.line?.transportMode === "rail")
      .map((call) => mapCall(call, type)),
    info: null,
    timing: { fetchMs },
  };
}
