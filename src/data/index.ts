import { z } from "zod";
import type { DateSpec } from "../lib/dates";
import { DEFAULT_CHRONOLOGY } from "./chronologies";
import {
  Empire, Era, Event, Journey, Location, Person, RegionCollection, Tour,
  type RegionFeature,
} from "./schema";
import empiresJson from "./empires.json";
import erasJson from "./eras.json";
import eventsJson from "./events.json";
import peopleJson from "./people.json";
import locationsJson from "./locations.json";
import journeysJson from "./journeys.json";
import toursJson from "./tours.json";
import regionsJson from "./regions.json";

export type Dataset = {
  eras: Era[];
  empires: Empire[];
  events: Event[];
  people: Person[];
  locations: Location[];
  journeys: Journey[];
  tours: Tour[];
  regions: RegionCollection;
};

export function parseDataset(raw: Record<keyof Dataset, unknown>): Dataset {
  return {
    eras: z.array(Era).parse(raw.eras),
    empires: z.array(Empire).parse(raw.empires),
    events: z.array(Event).parse(raw.events),
    people: z.array(Person).parse(raw.people),
    locations: z.array(Location).parse(raw.locations),
    journeys: z.array(Journey).parse(raw.journeys),
    tours: z.array(Tour).parse(raw.tours),
    regions: RegionCollection.parse(raw.regions),
  };
}

export const data: Dataset = parseDataset({
  eras: erasJson,
  empires: empiresJson,
  events: eventsJson,
  people: peopleJson,
  locations: locationsJson,
  journeys: journeysJson,
  tours: toursJson,
  regions: regionsJson,
});

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export const erasById = byId(data.eras);
export const empiresById = byId(data.empires);
export const eventsById = byId(data.events);
export const peopleById = byId(data.people);
export const locationsById = byId(data.locations);
export const journeysById = byId(data.journeys);
export const toursById = byId(data.tours);
export const regionsById = new Map<string, RegionFeature>(
  data.regions.features.map((f) => [f.properties.id, f]),
);

export type EntityKind = "event" | "person" | "location" | "era" | "empire";
export type EntityRef = { kind: EntityKind; id: string };

/** Dates for an entity under a chronology, falling back to the default chronology. */
export function datesFor(
  entity: { dates?: Record<string, DateSpec> },
  chronologyId: string,
): DateSpec | undefined {
  return entity.dates?.[chronologyId] ?? entity.dates?.[DEFAULT_CHRONOLOGY];
}

/** People whose `parents` include this person. */
export function childrenOf(personId: string): Person[] {
  return data.people.filter((p) => p.parents.includes(personId));
}
