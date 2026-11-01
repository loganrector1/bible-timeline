import { data, regionsById } from "../data";
import type { Event, EventType } from "../data/schema";
import { entityBounds, eventLocations, eventMidpoint } from "./entities";
import { overlaps, type Passage } from "./passages";

/**
 * Which events are shown: of any of these types, involving any of these people, told in any of
 * these passages, in any of these eras, and at any of these places. Each kind left empty lets
 * everything through, and each kind in use must match. Filters only hide events; people, places
 * and eras stay.
 */
export type Filters = { types: EventType[]; people: string[]; passages: Passage[]; eras: string[]; places: string[] };

export const NO_FILTERS: Filters = { types: [], people: [], passages: [], eras: [], places: [] };

/** Event types as filter choices, in a reader's order rather than the schema's. */
export const FILTER_TYPES: { type: EventType; label: string }[] = [
  { type: "covenant", label: "Covenants" },
  { type: "miracle", label: "Miracles" },
  { type: "battle", label: "Battles" },
  { type: "journey", label: "Journeys" },
  { type: "judgment", label: "Judgments" },
  { type: "prophecy", label: "Prophecy" },
  { type: "ministry", label: "Ministries" },
  { type: "worship", label: "Worship" },
  { type: "writing", label: "Writings" },
  { type: "reign", label: "Reigns" },
  { type: "family", label: "Family" },
  { type: "birth", label: "Births" },
  { type: "death", label: "Deaths" },
  { type: "other", label: "Other events" },
];
export const TYPE_FILTER_LABEL = new Map(FILTER_TYPES.map((t) => [t.type, t.label]));

export function hasFilters(f: Filters): boolean {
  return f.types.length > 0 || f.people.length > 0 || f.passages.length > 0 || f.eras.length > 0 || f.places.length > 0;
}

/** Whether an event falls in an era: its midpoint does, as in the era's own list of events. */
function inEra(ev: Event, eraId: string, chron: string): boolean {
  const b = entityBounds({ kind: "era", id: eraId }, chron);
  const mid = eventMidpoint(ev, chron);
  return !!b && mid !== undefined && mid >= b[0] && mid < b[1];
}

/** Whether a point is inside a ring (ray casting). */
function inRing([x, y]: number[], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** For a place with an outline (Canaan, Egypt), the places inside it; undefined for the rest. */
const insideCache = new Map<string, Set<string> | undefined>();
function placesInside(placeId: string): Set<string> | undefined {
  if (!insideCache.has(placeId)) {
    const f = regionsById.get(placeId);
    const polygons = !f ? [] : f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    insideCache.set(placeId, f && new Set(
      data.locations.filter((l) => polygons.some((rings) => inRing(l.coords, rings[0]))).map((l) => l.id),
    ));
  }
  return insideCache.get(placeId);
}

/** Whether an event happens at a place: at one of its places, regions or journey stops, or inside its outline. */
function atPlace(ev: Event, placeId: string): boolean {
  if (ev.regions.includes(placeId)) return true;
  const ids = eventLocations(ev).map((l) => l.id);
  if (ids.includes(placeId)) return true;
  const inside = placesInside(placeId);
  return !!inside && ids.some((id) => inside.has(id));
}

export function eventShown(ev: Event, f: Filters, chron: string): boolean {
  return (!f.types.length || f.types.includes(ev.type))
    && (!f.people.length || ev.people.some((p) => f.people.includes(p)))
    && (!f.passages.length || ev.scripture.some((r) => f.passages.some((p) => overlaps(r, p))))
    && (!f.eras.length || f.eras.some((e) => inEra(ev, e, chron)))
    && (!f.places.length || f.places.some((p) => atPlace(ev, p)));
}

/**
 * Whether routine births and deaths of this type are drawn as marks on people's bars. Not while
 * they're filtered to: then they're what the reader asked to see, so they're ordinary event dots.
 */
export function drawnAsLifeMark(ev: Event, f: Filters): boolean {
  return !f.types.includes(ev.type);
}

/**
 * The people who stand out while filtering with nothing selected: the people filtered to, or
 * without a person filter, everyone in a shown event. Undefined when nothing is filtered.
 */
export function filteredPeople(events: Event[], f: Filters, chron: string): Set<string> | undefined {
  if (f.people.length) return new Set(f.people);
  if (!hasFilters(f)) return undefined;
  return new Set(events.filter((ev) => eventShown(ev, f, chron)).flatMap((ev) => ev.people));
}

/** A predicate for the events shown, or undefined (every event) when nothing is filtered. */
export function shownBy(f: Filters, chron: string): ((ev: Event) => boolean) | undefined {
  return hasFilters(f) ? (ev) => eventShown(ev, f, chron) : undefined;
}
