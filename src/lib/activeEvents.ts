import type { Event } from "../data/schema";
import { eventBounds, eventsInOrder } from "./entities";

/** How many events the map treats as "now", whatever the time zoom. */
export const NEAREST_COUNT = 5;

/**
 * Each year of an event's length counts as this many years of distance, so a long
 * background span (a century of slavery) yields to a specific event within a few years,
 * but still wins when nothing specific is near.
 */
const LENGTH_WEIGHT = 1 / 20;

/** How far an event is from the cursor, in years: the gap to it (0 while it's under way) plus a share of its length. */
export function distanceFrom(currentYear: number, ev: Event, chron: string): number {
  const [lo, hi] = eventBounds(ev, chron)!;
  const gap = currentYear < lo ? lo - currentYear : currentYear > hi ? currentYear - hi : 0;
  return gap + (hi - lo) * LENGTH_WEIGHT;
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
