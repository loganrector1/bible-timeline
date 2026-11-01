import { DEFAULT_CHRONOLOGY } from "./chronologies";
import type { Dataset } from "./index";

/**
 * Checks the links between entities: every referenced id exists, ids are
 * unique, and every dated entity has a default-chronology date.
 * Returns human-readable problems; an empty array means the data is consistent.
 */
export function findProblems(d: Dataset): string[] {
  const problems: string[] = [];

  const sets = {
    era: idSet(d.eras, "era", problems),
    event: idSet(d.events, "event", problems),
    person: idSet(d.people, "person", problems),
    location: idSet(d.locations, "location", problems),
    journey: idSet(d.journeys, "journey", problems),
    region: idSet(d.regions.features.map((f) => f.properties), "region", problems),
  };

  const check = (owner: string, kind: keyof typeof sets, refs: string[]) => {
    for (const ref of refs) {
      if (!sets[kind].has(ref)) problems.push(`${owner} references unknown ${kind} "${ref}"`);
    }
  };

  const needsDefault = (owner: string, dates: Record<string, unknown> | undefined) => {
    if (dates && !(DEFAULT_CHRONOLOGY in dates)) {
      problems.push(`${owner} has dates but none for the default chronology "${DEFAULT_CHRONOLOGY}"`);
    }
  };

  for (const era of d.eras) needsDefault(`era ${era.id}`, era.dates);

  for (const ev of d.events) {
    const owner = `event ${ev.id}`;
    needsDefault(owner, ev.dates);
    check(owner, "person", ev.people);
    check(owner, "location", ev.locations);
    check(owner, "region", ev.regions);
    if (ev.journeyId) check(owner, "journey", [ev.journeyId]);
    if (ev.partOf) check(owner, "event", [ev.partOf]);
  }

  // Parent events are one level deep, and a child happens at a stop on its parent's journey.
  const events = new Map(d.events.map((ev) => [ev.id, ev]));
  const journeys = new Map(d.journeys.map((j) => [j.id, j]));
  for (const ev of d.events) {
    const parent = ev.partOf ? events.get(ev.partOf) : undefined;
    if (!parent) continue;
    if (parent.partOf) problems.push(`event ${ev.id} is part of ${parent.id}, which is itself part of another event`);
    const stops = parent.journeyId ? journeys.get(parent.journeyId)?.stops.map((s) => s.locationId) : undefined;
    if (stops && !ev.locations.some((l) => stops.includes(l))) {
      problems.push(`event ${ev.id} is part of ${parent.id} but none of its places is a stop on that journey`);
    }
  }

  idSet(d.tours, "tour", problems);
  for (const t of d.tours) check(`tour ${t.id}`, "event", t.steps.map((s) => s.event));

  for (const p of d.people) {
    const owner = `person ${p.id}`;
    needsDefault(owner, p.dates);
    check(owner, "person", [...p.parents, ...p.spouses]);
  }

  // Region outlines are the shapes of places, so each must share its id with a location.
  for (const f of d.regions.features) {
    if (!sets.location.has(f.properties.id)) {
      problems.push(`region "${f.properties.id}" has no matching location`);
    }
  }

  for (const j of d.journeys) {
    check(`journey ${j.id}`, "location", j.stops.map((s) => s.locationId));
  }

  return problems;
}

function idSet(items: { id: string }[], kind: string, problems: string[]): Set<string> {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) problems.push(`duplicate ${kind} id "${id}"`);
    seen.add(id);
  }
  return seen;
}
