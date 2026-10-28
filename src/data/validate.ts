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
  }

  for (const p of d.people) {
    const owner = `person ${p.id}`;
    needsDefault(owner, p.dates);
    check(owner, "person", [...p.parents, ...p.spouses]);
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
