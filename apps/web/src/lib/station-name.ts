/** "Battistini (Roma)" reads as "Battistini" next to a line that already says where it runs. */
export function shortStationName(name: string): string {
  return name.replace(/\s+\([^)]*\)$/, "");
}
