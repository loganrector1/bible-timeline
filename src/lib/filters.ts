import type { Event, EventType } from "../data/schema";
import { overlaps, type Passage } from "./passages";

/**
 * Which events are shown: of any of these types (all, if none), involving any of these people
 * (anyone, if none), and told in any of these passages (anywhere, if none). Filters only hide
 * events; people, places and eras stay.
 */
export type Filters = { types: EventType[]; people: string[]; passages: Passage[] };

export const NO_FILTERS: Filters = { types: [], people: [], passages: [] };

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
  return f.types.length > 0 || f.people.length > 0 || f.passages.length > 0;
}

export function eventShown(ev: Event, f: Filters): boolean {
  return (!f.types.length || f.types.includes(ev.type))
    && (!f.people.length || ev.people.some((p) => f.people.includes(p)))
    && (!f.passages.length || ev.scripture.some((r) => f.passages.some((p) => overlaps(r, p))));
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
export function filteredPeople(events: Event[], f: Filters): Set<string> | undefined {
  if (f.people.length) return new Set(f.people);
  if (!hasFilters(f)) return undefined;
  return new Set(events.filter((ev) => eventShown(ev, f)).flatMap((ev) => ev.people));
}

/** A predicate for the events shown, or undefined (every event) when nothing is filtered. */
export function shownBy(f: Filters): ((ev: Event) => boolean) | undefined {
  return hasFilters(f) ? (ev) => eventShown(ev, f) : undefined;
}
