import type { Event } from "../data/schema";
import { adjacentEvent, eventBounds, eventsInOrder } from "./entities";

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
 * The anchor (the selected event, or else the nearest) is always included with the
 * events just before and after it, so the list doubles as a way to step through time;
 * nearest events fill the rest.
 */
export function activeEvents(currentYear: number, chron: string, selected?: Event): Event[] {
  const byDistance = eventsInOrder(chron)
    .map((ev) => ({ ev, d: distanceFrom(currentYear, ev, chron) }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.ev);
  const anchor = selected ?? byDistance[0];
  if (!anchor) return [];
  const picked = new Set(
    [anchor, adjacentEvent(-1, chron, currentYear, anchor.id), adjacentEvent(1, chron, currentYear, anchor.id)]
      .filter((ev): ev is Event => ev !== undefined),
  );
  for (const ev of byDistance) {
    if (picked.size >= NEAREST_COUNT) break;
    picked.add(ev);
  }
  return byDistance.filter((ev) => picked.has(ev));
}
