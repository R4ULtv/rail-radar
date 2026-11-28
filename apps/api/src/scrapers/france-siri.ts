const SIRI_URL = "https://proxy.transport.data.gouv.fr/resource/sncf-siri-lite-estimated-timetable";
const CACHE_NAME = "sncf-siri-stop-calls";
const CACHE_SECONDS = 60;
const MAX_FEED_AGE_MS = 5 * 60_000;
const FETCH_TIMEOUT_MS = 4_000;
const MAX_FEED_BYTES = 32 * 1024 * 1024;
const MAX_PENDING_XML = 1024 * 1024;
const JOURNEY_START = "<EstimatedVehicleJourney>";
const JOURNEY_END = "</EstimatedVehicleJourney>";

interface SiriTime {
  aimedAt: number;
  expectedAt: number | null;
  platform: string | null;
}

export interface SiriStopCall {
  trainNumbers: string[];
  arrival: SiriTime | null;
  departure: SiriTime | null;
  cancelled: boolean;
}

interface SiriSnapshot {
  timestamp: number;
  calls: SiriStopCall[];
}

function isFresh(timestamp: number): boolean {
  const age = Date.now() - timestamp;
  return age >= -30_000 && age <= MAX_FEED_AGE_MS;
}

function xmlText(xml: string, tag: string): string {
  const opening = `<${tag}>`;
  const start = xml.indexOf(opening);
  if (start === -1) return "";
  const end = xml.indexOf(`</${tag}>`, start + opening.length);
  return end === -1 ? "" : xml.slice(start + opening.length, end).trim();
}

function readTime(xml: string, kind: "Arrival" | "Departure", usePrediction: boolean) {
  const aimedAt = Date.parse(xmlText(xml, `Aimed${kind}Time`));
  if (!Number.isFinite(aimedAt)) return null;
  const actualAt = Date.parse(xmlText(xml, `Actual${kind}Time`));
  const predictedAt = Date.parse(xmlText(xml, `Expected${kind}Time`));
  return {
    aimedAt,
    expectedAt: Number.isFinite(actualAt)
      ? actualAt
      : usePrediction && Number.isFinite(predictedAt)
        ? predictedAt
        : null,
    platform: xmlText(xml, `${kind}PlatformName`) || null,
  };
}

function collectCalls(journey: string, stopRef: string, calls: SiriStopCall[]) {
  const callsStart = journey.search(/<(?:Estimated|Recorded)Calls>/);
  if (callsStart === -1) return;
  const header = journey.slice(0, callsStart);
  if (xmlText(header, "VehicleMode") !== "rail") return;
  const trainNumbers = Array.from(
    header.matchAll(/<TrainNumberRef>(\d+)<\/TrainNumberRef>/g),
    (match) => match[1]!,
  );
  if (trainNumbers.length === 0) return;

  const journeyCancelled = xmlText(header, "Cancellation") === "true";
  const monitored = xmlText(header, "Monitored") !== "false";
  const journeyPredictionInaccurate = xmlText(header, "PredictionInaccurate") === "true";
  for (const match of journey.matchAll(/<(EstimatedCall|RecordedCall)>([\s\S]*?)<\/\1>/g)) {
    const call = match[2]!;
    if (!call.includes(stopRef)) continue;
    const usePrediction =
      monitored && !journeyPredictionInaccurate && xmlText(call, "PredictionInaccurate") !== "true";
    const arrival = readTime(call, "Arrival", usePrediction);
    const departure = readTime(call, "Departure", usePrediction);
    if (arrival || departure) {
      calls.push({
        trainNumbers,
        arrival,
        departure,
        cancelled: journeyCancelled || xmlText(call, "Cancellation") === "true",
      });
    }
  }
}

// SNCF publishes one national XML file. Retain only the current journey and the requested calls.
async function readStationCalls(
  body: ReadableStream<Uint8Array>,
  uic: string,
): Promise<SiriSnapshot> {
  const stopRef = `<StopPointRef>FR:ScheduledStopPoint::${uic}</StopPointRef>`;
  const calls: SiriStopCall[] = [];
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });
  let timestamp = NaN;
  let bytes = 0;
  let pending = "";

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_FEED_BYTES) throw new Error("SNCF SIRI feed exceeds the size limit.");
      pending += decoder.decode(value, { stream: true });

      if (!Number.isFinite(timestamp)) {
        const rawTimestamp = xmlText(pending, "ResponseTimestamp");
        if (rawTimestamp) {
          timestamp = Date.parse(rawTimestamp);
          if (!isFresh(timestamp))
            throw new Error("SNCF SIRI feed timestamp is outside its window.");
        }
      }

      let offset = 0;
      for (
        let end = pending.indexOf(JOURNEY_END);
        end !== -1;
        end = pending.indexOf(JOURNEY_END, offset)
      ) {
        const start = pending.indexOf(JOURNEY_START, offset);
        if (start === -1 || start > end) throw new Error("Invalid SNCF SIRI journey.");
        const journey = pending.slice(start + JOURNEY_START.length, end);
        if (journey.includes(stopRef)) collectCalls(journey, stopRef, calls);
        offset = end + JOURNEY_END.length;
      }
      pending = pending.slice(offset);
      if (pending.length > MAX_PENDING_XML) throw new Error("Invalid SNCF SIRI journey size.");
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }

  pending += decoder.decode();
  if (
    !isFresh(timestamp) ||
    !pending.trimEnd().endsWith("</Siri>") ||
    pending.includes(JOURNEY_START)
  ) {
    throw new Error("Incomplete SNCF SIRI feed.");
  }
  return { timestamp, calls };
}

export async function getSiriStopCalls(stationId: string): Promise<SiriStopCall[]> {
  // Rail Radar's French station IDs omit the leading 87 from SNCF's eight-digit UIC code.
  if (!/^FR\d{6}$/.test(stationId)) return [];
  const uic = `87${stationId.slice(2)}`;
  const key = `https://api.railradar24.com/__internal/sncf-siri-et/v1/${uic}`;
  let cache: Cache | undefined;
  try {
    cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(key);
    if (hit) {
      const snapshot = await hit.json<SiriSnapshot>();
      if (isFresh(snapshot.timestamp)) return snapshot.calls;
    }
  } catch {
    // A cache outage still allows a fresh fetch.
  }

  let snapshot: SiriSnapshot;
  try {
    const response = await fetch(SIRI_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // Share the national download across stations. Only successful responses are cached.
      cf: { cacheEverything: true, cacheTtlByStatus: { "200": CACHE_SECONDS, "201-599": -1 } },
    });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      return [];
    }
    snapshot = await readStationCalls(response.body, uic);
  } catch {
    return [];
  }

  try {
    await cache?.put(
      key,
      Response.json(snapshot, { headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` } }),
    );
  } catch {
    // A failed cache write does not affect the board.
  }
  return snapshot.calls;
}
