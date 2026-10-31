import { data, journeysById, locationsById } from "../data";
import { DEFAULT_CHRONOLOGY } from "../data/chronologies";
import type { Event } from "../data/schema";
import { childEvents } from "./entities";

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
 * The journey split into legs. When two legs share a stretch of road (the same two points,
 * stops or `via`, in either direction), both get a sideways offset. MapLibre offsets to the
 * right of the line's direction, so an out-and-back pair ends up side by side instead of on
 * top of each other, even when only part of the way is shared (to Egypt and back to Nazareth).
 */
export function journeyLegs(journeyId: string): Leg[] {
  const stops = journeysById.get(journeyId)!.stops;
  const coords = routeCoords(journeyId);
  const paths = coords.slice(1).map((to, i): Coord[] => [coords[i], ...((stops[i + 1].via ?? []) as Coord[]), to]);
  const stretchKeys = (path: Coord[]) => path.slice(1).map((b, i) => [path[i].join(","), b.join(",")].sort().join("|"));
  const counts = new Map<string, number>();
  for (const path of paths) for (const key of stretchKeys(path)) counts.set(key, (counts.get(key) ?? 0) + 1);
  return paths.map((path) => ({
    path,
    offset: stretchKeys(path).some((key) => counts.get(key)! > 1) ? RETRACE_OFFSET_PX : 0,
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

/**
 * The stop where an event along the journey happens, or -1. Events along the way are matched
 * in date order, each to the next stop at its place from where the one before it was: Troas
 * comes twice on Paul's third journey, and Eutychus falls on the way back, after Romans at
 * Corinth. An event's first place counts before its others, since a letter lists where it was
 * written before where it was sent (Thessalonians marks Corinth, not Thessalonica).
 */
export function stopIndexOf(journeyId: string, ev: Event, chron: string = DEFAULT_CHRONOLOGY): number {
  const stops = journeysById.get(journeyId)!.stops;
  const stopFrom = (e: Event, from: number) => {
    for (const start of [from, 0]) {
      for (const place of e.locations) {
        const i = stops.findIndex((s, k) => k >= start && s.locationId === place);
        if (i >= 0) return i;
      }
    }
    return -1;
  };
  const parent = eventForJourney(journeyId);
  const along = parent && ev.partOf === parent.id ? childEvents(parent, chron) : [ev];
  let from = 0;
  for (const e of along) {
    const i = stopFrom(e, from);
    if (e.id === ev.id) return i;
    if (i >= 0) from = i;
  }
  return -1;
}
