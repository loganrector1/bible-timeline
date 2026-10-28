import { data, journeysById, locationsById } from "../data";
import type { Event } from "../data/schema";

export type Coord = [number, number];

/** The way from one stop to the next: `legs[i]` arrives at stop `i + 1`. */
export type Leg = {
  /** From the stop, through any `via` points, to the next stop. */
  path: Coord[];
  /** Pixels to shift the leg sideways. Legs that retrace an earlier path get pushed apart. */
  offset: number;
};

/** Pause before a selected journey starts drawing, so the map's fly-to can finish. */
export const JOURNEY_DELAY_MS = 900;

const RETRACE_OFFSET_PX = 3.5;

/** Where each stop is. */
export function routeCoords(journeyId: string): Coord[] {
  return journeysById.get(journeyId)!.stops.map((s) => locationsById.get(s.locationId)!.coords as Coord);
}

/** The whole route as one line, through the stops and the points between them. */
export function routePath(journeyId: string): Coord[] {
  const legs = journeyLegs(journeyId);
  return legs.length ? [legs[0].path[0], ...legs.flatMap((l) => l.path.slice(1))] : routeCoords(journeyId);
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
    path: [coords[i], ...((stops[i + 1].via ?? []) as Coord[]), to],
    offset: counts.get(pairKey(i))! > 1 ? RETRACE_OFFSET_PX : 0,
  }));
}

const segment = (a: Coord, b: Coord) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const pathLength = (path: Coord[]) => path.slice(1).reduce((sum, p, i) => sum + segment(path[i], p), 0);

/**
 * The route drawn so far at `progress` (0–1, by length): whole legs, then part of the
 * next, ending at `head`. `reached` counts the stops the line has got to, the first included.
 */
export function drawnLegs(legs: Leg[], progress: number): { legs: Leg[]; head?: Coord; reached: number } {
  const total = legs.reduce((a, l) => a + pathLength(l.path), 0);
  if (progress >= 1 || total === 0) return { legs, reached: legs.length + 1 };
  let remaining = progress * total;
  const out: Leg[] = [];
  for (const leg of legs) {
    const len = pathLength(leg.path);
    if (remaining >= len) {
      out.push(leg);
      remaining -= len;
      continue;
    }
    // Part of this leg: walk its segments until the remaining length runs out.
    const reached = out.length + 1;
    const path: Coord[] = [leg.path[0]];
    for (let i = 1; i < leg.path.length; i++) {
      const [a, b] = [leg.path[i - 1], leg.path[i]];
      const d = segment(a, b);
      if (remaining < d) {
        const f = remaining / d;
        path.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
        break;
      }
      path.push(b);
      remaining -= d;
    }
    const head = path[path.length - 1];
    if (remaining > 0 || path.length > 2) out.push({ ...leg, path });
    return { legs: out, head, reached };
  }
  return { legs: out, reached: out.length + 1 };
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
