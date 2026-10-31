import type { Event, EventType } from "../data/schema";

/**
 * Which events are shown: of any of these types (all, if none) and involving any of these
 * people (anyone, if none). Filters only hide events; people, places and eras stay.
 */
export type Filters = { types: EventType[]; people: string[] };

export const NO_FILTERS: Filters = { types: [], people: [] };

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
  return f.types.length > 0 || f.people.length > 0;
}

export function eventShown(ev: Event, f: Filters): boolean {
  return (!f.types.length || f.types.includes(ev.type)) && (!f.people.length || ev.people.some((p) => f.people.includes(p)));
}

/** A predicate for the events shown, or undefined (every event) when nothing is filtered. */
export function shownBy(f: Filters): ((ev: Event) => boolean) | undefined {
  return hasFilters(f) ? (ev) => eventShown(ev, f) : undefined;
}
