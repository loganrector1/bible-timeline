import {
  data, datesFor, erasById, eventsById, journeysById, locationsById, peopleById,
  type EntityRef,
} from "../data";
import type { Event, Location } from "../data/schema";
import { specBounds, specMidpoint } from "./dates";

export type Bounds = [number, number];

export function eventBounds(ev: Event, chron: string): Bounds | undefined {
  const spec = datesFor(ev, chron);
  return spec && specBounds(spec);
}

export function eventMidpoint(ev: Event, chron: string): number | undefined {
  const spec = datesFor(ev, chron);
  return spec && specMidpoint(spec);
}

/** Events sorted by date under a chronology. Undated events are left out. */
export function eventsInOrder(chron: string): Event[] {
  return data.events
    .filter((ev) => datesFor(ev, chron))
    .sort((a, b) => eventMidpoint(a, chron)! - eventMidpoint(b, chron)!);
}

/**
 * The next (dir = 1) or previous (dir = -1) event: relative to the selected event if
 * there is one, so events sharing a date are each visited, otherwise to the cursor.
 */
export function adjacentEvent(
  dir: 1 | -1, chron: string, currentYear: number, selectedEventId?: string,
): Event | undefined {
  const ordered = eventsInOrder(chron);
  const i = selectedEventId ? ordered.findIndex((e) => e.id === selectedEventId) : -1;
  if (i >= 0) return ordered[i + dir];
  const eps = 1e-6;
  return dir === 1
    ? ordered.find((ev) => eventMidpoint(ev, chron)! > currentYear + eps)
    : ordered.findLast((ev) => eventMidpoint(ev, chron)! < currentYear - eps);
}

export function eventsForPerson(personId: string, chron: string): Event[] {
  return eventsInOrder(chron).filter((ev) => ev.people.includes(personId));
}

export function eventsAtLocation(locationId: string, chron: string): Event[] {
  return eventsInOrder(chron).filter(
    (ev) =>
      ev.locations.includes(locationId) ||
      ev.regions.includes(locationId) ||
      (ev.journeyId !== undefined &&
        journeysById.get(ev.journeyId)!.stops.some((s) => s.locationId === locationId)),
  );
}

export function eventsInEra(eraId: string, chron: string): Event[] {
  const b = entityBounds({ kind: "era", id: eraId }, chron);
  if (!b) return [];
  return eventsInOrder(chron).filter((ev) => {
    const mid = eventMidpoint(ev, chron)!;
    return mid >= b[0] && mid < b[1];
  });
}

function unionBounds(list: (Bounds | undefined)[]): Bounds | undefined {
  const defined = list.filter((b): b is Bounds => b !== undefined);
  if (defined.length === 0) return undefined;
  return [Math.min(...defined.map((b) => b[0])), Math.max(...defined.map((b) => b[1]))];
}

/** The span of time an entity covers: its own dates, or the span of its events. */
export function entityBounds(ref: EntityRef, chron: string): Bounds | undefined {
  switch (ref.kind) {
    case "event": {
      const ev = eventsById.get(ref.id);
      return ev && eventBounds(ev, chron);
    }
    case "era": {
      const era = erasById.get(ref.id);
      const spec = era && datesFor(era, chron);
      return spec && specBounds(spec);
    }
    case "person": {
      const p = peopleById.get(ref.id);
      if (!p) return undefined;
      const spec = datesFor(p, chron);
      if (spec) return specBounds(spec);
      return unionBounds(eventsForPerson(p.id, chron).map((ev) => eventBounds(ev, chron)));
    }
    case "location":
      return unionBounds(eventsAtLocation(ref.id, chron).map((ev) => eventBounds(ev, chron)));
  }
}

/** Locations an event touches, including every stop on its journey, in order and without repeats. */
export function eventLocations(ev: Event): Location[] {
  const ids = [...ev.locations];
  if (ev.journeyId) ids.push(...journeysById.get(ev.journeyId)!.stops.map((s) => s.locationId));
  return [...new Set(ids)].map((id) => locationsById.get(id)!);
}

/** Places to frame on the map when an entity is selected. */
export function entityLocations(ref: EntityRef, chron: string): Location[] {
  switch (ref.kind) {
    case "event": {
      const ev = eventsById.get(ref.id);
      return ev ? eventLocations(ev) : [];
    }
    case "location": {
      const loc = locationsById.get(ref.id);
      return loc ? [loc] : [];
    }
    case "person":
      return [...new Set(eventsForPerson(ref.id, chron).flatMap(eventLocations))];
    case "era":
      return [...new Set(eventsInEra(ref.id, chron).flatMap(eventLocations))];
  }
}

export function entityTitle(ref: EntityRef): string {
  switch (ref.kind) {
    case "event": return eventsById.get(ref.id)?.title ?? ref.id;
    case "person": return peopleById.get(ref.id)?.name ?? ref.id;
    case "location": return locationsById.get(ref.id)?.name ?? ref.id;
    case "era": return erasById.get(ref.id)?.name ?? ref.id;
  }
}

const rangeCache = new Map<string, Bounds>();

/** Overall time range of the dataset, with a little padding. */
export function datasetRange(chron: string): Bounds {
  const cached = rangeCache.get(chron);
  if (cached) return cached;
  const all = [
    ...data.eras.map((e) => entityBounds({ kind: "era", id: e.id }, chron)),
    ...data.events.map((e) => eventBounds(e, chron)),
  ];
  const [lo, hi] = unionBounds(all) ?? [-4000, 100];
  const pad = (hi - lo) * 0.02;
  const range: Bounds = [lo - pad, hi + pad];
  rangeCache.set(chron, range);
  return range;
}
