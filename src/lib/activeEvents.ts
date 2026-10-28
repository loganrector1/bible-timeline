import type { Event } from "../data/schema";
import { eventBounds, eventsInOrder } from "./entities";

/** How many events the map treats as "now", whatever the time zoom. */
export const NEAREST_COUNT = 5;

/** Years between the cursor and an event; 0 while the event is under way. */
export function distanceFrom(currentYear: number, ev: Event, chron: string): number {
  const [lo, hi] = eventBounds(ev, chron)!;
  return currentYear < lo ? lo - currentYear : currentYear > hi ? currentYear - hi : 0;
}

/**
 * The events nearest the current moment, nearest first. A fixed count rather than a
 * time window, so the map is never empty in quiet stretches or crowded in busy ones.
 */
export function activeEvents(currentYear: number, chron: string, count = NEAREST_COUNT): Event[] {
  return eventsInOrder(chron)
    .map((ev) => ({ ev, d: distanceFrom(currentYear, ev, chron) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map((x) => x.ev);
}
