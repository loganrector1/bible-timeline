import { data, journeysById, locationsById } from "../data";
import type { Event } from "../data/schema";

export type Coord = [number, number];

export type Leg = {
  from: Coord;
  to: Coord;
  /** Pixels to shift the leg sideways. Legs that retrace an earlier path get pushed apart. */
  offset: number;
};

/** Pause before a selected journey starts drawing, so the map's fly-to can finish. */
export const JOURNEY_DELAY_MS = 900;

const RETRACE_OFFSET_PX = 3.5;

export function routeCoords(journeyId: string): Coord[] {
  return journeysById.get(journeyId)!.stops.map((s) => locationsById.get(s.locationId)!.coords as Coord);
}

/**
 * The journey split into legs. When two legs join the same pair of places (in either
 * direction), both get a sideways offset. MapLibre offsets to the right of the line's
 * direction, so an out-and-back pair ends up side by side instead of on top of each other.
 */
export function journeyLegs(journeyId: string): Leg[] {
  const stops = journeysById.get(journeyId)!.stops;
  const coords = routeCoords(journeyId);
  const pairKey = (i: number) => [stops[i].locationId, stops[i + 1].locationId].sort().join("|");
  const counts = new Map<string, number>();
  for (let i = 0; i < stops.length - 1; i++) counts.set(pairKey(i), (counts.get(pairKey(i)) ?? 0) + 1);
  return coords.slice(1).map((to, i) => ({
    from: coords[i],
    to,
    offset: counts.get(pairKey(i))! > 1 ? RETRACE_OFFSET_PX : 0,
  }));
}

/** How long the drawing animation for a journey runs, in milliseconds. */
export function journeyDuration(journeyId: string): number {
  const legs = journeysById.get(journeyId)!.stops.length - 1;
  return Math.min(6000, Math.max(2000, legs * 700));
}

export function eventForJourney(journeyId: string): Event | undefined {
  return data.events.find((ev) => ev.journeyId === journeyId);
}

/** The first stop on the journey at one of the event's places, or -1. */
export function stopIndexOf(journeyId: string, ev: Event): number {
  return journeysById.get(journeyId)!.stops.findIndex((s) => ev.locations.includes(s.locationId));
}
