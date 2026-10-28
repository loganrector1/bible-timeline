import type { Event } from "../data/schema";
import { eventBounds, eventsInOrder } from "./entities";

/**
 * How far either side of the cursor counts as "now" on the map. It follows the
 * timeline zoom: roughly the events within 150px of the cursor line.
 */
export function nowWindow(pxPerYear: number): number {
  return Math.max(150 / pxPerYear, 3 / 365);
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
