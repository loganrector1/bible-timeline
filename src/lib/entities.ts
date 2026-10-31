import {
  data, datesFor, erasById, eventsById, journeysById, locationsById, peopleById,
  type EntityRef,
} from "../data";
import type { Event, Location } from "../data/schema";
import { specBounds, specExtent, specMidpoint } from "./dates";

export type Bounds = [number, number];

export function eventBounds(ev: Event, chron: string): Bounds | undefined {
  const spec = datesFor(ev, chron);
  return spec && specBounds(spec);
}

export function eventMidpoint(ev: Event, chron: string): number | undefined {
  const spec = datesFor(ev, chron);
  return spec && specMidpoint(spec);
}

/**
 * Where an event falls in date order: where it's drawn (`specExtent`), from its start. A span
 * counts from its start, so a journey comes before what happens along it. Dates count from
 * the middle of their precision, since "4th month" is a best guess at mid-month, not the 1st.
 */
export function eventOrderKey(ev: Event, chron: string): number {
  const spec = datesFor(ev, chron)!;
  const own = specExtent(spec)[0];
  // Never before the event it's part of.
  const parent = parentEvent(ev);
  return parent && datesFor(parent, chron) ? Math.max(own, eventOrderKey(parent, chron)) : own;
}

/** The larger event this one is part of, if any. */
export function parentEvent(ev: Event): Event | undefined {
  return ev.partOf ? eventsById.get(ev.partOf) : undefined;
}

/** The events that are part of this one, in date order. */
export function childEvents(ev: Event, chron: string): Event[] {
  return eventsInOrder(chron).filter((c) => c.partOf === ev.id);
}

/** The journey an event draws on the map: its own, or else its parent's. */
export function journeyOf(ev: Event): string | undefined {
  return ev.journeyId ?? parentEvent(ev)?.journeyId;
}

/**
 * Events sorted by date under a chronology. On ties a parent comes before the events within
 * it, and otherwise the file's order (the order Scripture tells them) stands. Undated events
 * are left out.
 */
export function eventsInOrder(chron: string): Event[] {
  const parentFirst = (a: Event, b: Event) => (b.partOf === a.id ? -1 : a.partOf === b.id ? 1 : 0);
  return data.events
    .filter((ev) => datesFor(ev, chron))
    .sort((a, b) => eventOrderKey(a, chron) - eventOrderKey(b, chron) || parentFirst(a, b));
}

/**
 * The person whose birth or death this event is (the first person listed), when the event
 * is a routine one drawn as a mark on that person's lifespan rather than as its own dot.
 * Births and deaths the story dwells on are marked `major` and stay ordinary events.
 */
export function lifeMarkPerson(ev: Event, chron: string): string | undefined {
  if ((ev.type !== "birth" && ev.type !== "death") || ev.major) return undefined;
  const person = peopleById.get(ev.people[0]);
  return person && datesFor(person, chron) ? person.id : undefined;
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
    ? ordered.find((ev) => eventOrderKey(ev, chron) > currentYear + eps)
    : ordered.findLast((ev) => eventOrderKey(ev, chron) < currentYear - eps);
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
