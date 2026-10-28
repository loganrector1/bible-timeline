import { useMemo } from "react";
import { eventsById, type EntityRef } from "../data";
import {
  entityLocations, eventLocations, eventsAtLocation, eventsForPerson, eventsInEra,
} from "../lib/entities";
import { useStore } from "./store";

/** What to emphasize in both views for the current selection. `null` means nothing is selected. */
export type Highlight = {
  events: Set<string>;
  people: Set<string>;
  locations: Set<string>;
  regions: Set<string>;
  eraId?: string;
} | null;

export function computeHighlight(sel: EntityRef | null, chron: string): Highlight {
  if (!sel) return null;
  const locationIds = (refs: { id: string }[]) => new Set(refs.map((l) => l.id));

  switch (sel.kind) {
    case "event": {
      const ev = eventsById.get(sel.id);
      if (!ev) return null;
      return {
        events: new Set([ev.id]),
        people: new Set(ev.people),
        locations: locationIds(eventLocations(ev)),
        regions: new Set(ev.regions),
      };
    }
    case "person": {
      const evs = eventsForPerson(sel.id, chron);
      return {
        events: new Set(evs.map((e) => e.id)),
        people: new Set([sel.id]),
        locations: locationIds(entityLocations(sel, chron)),
        regions: new Set(),
      };
    }
    case "location": {
      const evs = eventsAtLocation(sel.id, chron);
      return {
        events: new Set(evs.map((e) => e.id)),
        people: new Set(evs.flatMap((e) => e.people)),
        locations: new Set([sel.id]),
        regions: new Set(),
      };
    }
    case "era": {
      const evs = eventsInEra(sel.id, chron);
      return {
        events: new Set(evs.map((e) => e.id)),
        people: new Set(),
        locations: locationIds(entityLocations(sel, chron)),
        regions: new Set(),
        eraId: sel.id,
      };
    }
  }
}

export function useHighlight(): Highlight {
  const selection = useStore((s) => s.selection);
  const chron = useStore((s) => s.chronologyId);
  return useMemo(() => computeHighlight(selection, chron), [selection, chron]);
}
