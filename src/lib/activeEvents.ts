import type { Event } from "../data/schema";
import { eventBounds, eventsInOrder } from "./entities";

/**
 * How far either side of the cursor counts as "now" on the map. It follows the
 * time zoom: roughly the events within 60px of the timeline's cursor line.
 */
export function nowWindow(pxPerYear: number): number {
  return Math.max(60 / pxPerYear, 2 / 365);
}

/** "±25 years", "±3 months", "±5 days". */
export function formatWindow(pxPerYear: number): string {
  const w = nowWindow(pxPerYear);
  const plural = (n: number, unit: string) => `±${n} ${unit}${n === 1 ? "" : "s"}`;
  if (w >= 1.5) return plural(Math.round(w), "year");
  if (w >= 1 / 12) return plural(Math.round(w * 12), "month");
  return plural(Math.max(1, Math.round(w * 365)), "day");
}

/** Events happening near the current moment, nearest first. */
export function activeEvents(currentYear: number, pxPerYear: number, chron: string): Event[] {
  const w = nowWindow(pxPerYear);
  const distance = (ev: Event) => {
    const [lo, hi] = eventBounds(ev, chron)!;
    return currentYear < lo ? lo - currentYear : currentYear > hi ? currentYear - hi : 0;
  };
  return eventsInOrder(chron)
    .filter((ev) => distance(ev) <= w)
    .sort((a, b) => distance(a) - distance(b));
}
