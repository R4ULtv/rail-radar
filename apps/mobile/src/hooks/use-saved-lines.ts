import { File, Paths } from "expo-file-system";
import { writeAsStringAsync } from "expo-file-system/legacy";
import { useSyncExternalStore } from "react";

import { getLine, type Line } from "@/lib/lines";

// Only the IDs are kept: lines ship with the app, and their IDs never change.
const file = new File(Paths.document, "saved-lines.json");
const listeners = new Set<() => void>();
const noLines: Line[] = [];
let ids: string[] | null = null;
let savedLines: Line[] = noLines;
let pendingWrite: Promise<void> = Promise.resolve();

function readIds(): string[] {
  if (ids) return ids;
  try {
    const parsed: unknown = file.exists ? JSON.parse(file.textSync()) : [];
    ids = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    ids = [];
  }
  savedLines = toLines(ids);
  return ids;
}

/** A line an app update removed stays saved, in case it comes back, but isn't shown. */
function toLines(lineIds: string[]): Line[] {
  const lines = lineIds.flatMap((id) => getLine(id) ?? []);
  return lines.length > 0 ? lines : noLines;
}

function read(): Line[] {
  readIds();
  return savedLines;
}

function write(next: string[]) {
  ids = next;
  savedLines = toLines(next);
  listeners.forEach((listener) => listener());
  // Like the saved stations: the UI updates at once and disk writes run one after another.
  pendingWrite = pendingWrite
    .then(() => writeAsStringAsync(file.uri, JSON.stringify(next)))
    .catch(() => {});
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSavedLines() {
  const lines = useSyncExternalStore(subscribe, read);

  return {
    savedLines: lines,
    isLineSaved: (id: string) => lines.some((line) => line.id === id),
    toggleSavedLine: (id: string) => {
      const current = readIds();
      write(current.includes(id) ? current.filter((saved) => saved !== id) : [id, ...current]);
    },
  };
}

export function clearSavedLines() {
  write([]);
}
