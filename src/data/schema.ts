import { z } from "zod";

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "ids are lowercase slugs");
const ids = z.array(id).default([]);

export const TimePoint = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
  label: z.string().optional(),
});

export const DateSpec = z.object({
  start: TimePoint,
  end: TimePoint.optional(),
  confidence: z.enum(["exact", "approx", "range", "unknown"]),
});

/** Dates keyed by chronology id. Must include the default chronology. */
const Dates = z.record(z.string(), DateSpec);

export const ScriptureRef = z.object({
  book: z.string(),
  chapter: z.number().int().min(1),
  verse: z.number().int().min(1).optional(),
  endChapter: z.number().int().min(1).optional(),
  endVerse: z.number().int().min(1).optional(),
});

const Coords = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

export const Era = z.object({
  id,
  name: z.string(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  summary: z.string(),
  dates: Dates,
  dateNote: z.string().optional(),
});

export const EventType = z.enum([
  "birth", "death", "battle", "covenant", "miracle", "journey",
  "reign", "prophecy", "judgment", "worship", "family",
  /** A prophet's or Jesus' public ministry. */
  "ministry",
  /** A book written, dated by when and where it was written rather than what it describes. */
  "writing",
  "other",
]);

export const Event = z.object({
  id,
  title: z.string(),
  type: EventType,
  /** Key events: their labels and dots win when the timeline is crowded. */
  major: z.boolean().default(false),
  summary: z.string(),
  description: z.string().optional(),
  dates: Dates,
  dateNote: z.string().optional(),
  people: ids,
  locations: ids,
  regions: ids,
  journeyId: id.optional(),
  /** The larger event this happens within, e.g. the Red Sea crossing during the Exodus. */
  partOf: id.optional(),
  scripture: z.array(ScriptureRef).default([]),
});

export const Person = z.object({
  id,
  name: z.string(),
  altNames: z.array(z.string()).default([]),
  roles: z.array(z.string()).default([]),
  summary: z.string(),
  /** Lifespan, where it can be estimated. */
  dates: Dates.optional(),
  dateNote: z.string().optional(),
  parents: ids,
  spouses: ids,
  scripture: z.array(ScriptureRef).default([]),
});

export const LocationType = z.enum([
  "city", "region", "mountain", "river", "sea", "wilderness", "site", "island",
]);

export const Location = z.object({
  id,
  name: z.string(),
  modernName: z.string().optional(),
  type: LocationType,
  /** [longitude, latitude] */
  coords: Coords,
  summary: z.string(),
  /** Set when the site's identification is disputed. */
  uncertain: z.boolean().default(false),
  note: z.string().optional(),
  alternateSites: z.array(z.object({ name: z.string(), coords: Coords })).default([]),
  /** OpenBible.info place name ("Bethel 1"), checked by scripts/openbible.mjs. */
  openbible: z.string().optional(),
});

export const JourneyStop = z.object({
  locationId: id,
  /** Points the route passes on its way to this stop, such as a sea lane around an island. */
  via: z.array(Coords).optional(),
  at: TimePoint.optional(),
  note: z.string().optional(),
});

export const Journey = z.object({
  id,
  name: z.string(),
  summary: z.string(),
  /** Chronology the stop times are given in. */
  chronology: z.string(),
  stops: z.array(JourneyStop).min(2),
});

const Ring = z.array(Coords).min(4);

export const RegionFeature = z.object({
  type: z.literal("Feature"),
  properties: z.object({ id, name: z.string(), summary: z.string().optional() }),
  geometry: z.union([
    z.object({ type: z.literal("Polygon"), coordinates: z.array(Ring) }),
    z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.array(Ring)) }),
  ]),
});

export const RegionCollection = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(RegionFeature),
});

// TimePoint and DateSpec types live in lib/dates.ts; these schemas match them.
export type ScriptureRef = z.infer<typeof ScriptureRef>;
export type Era = z.infer<typeof Era>;
export type EventType = z.infer<typeof EventType>;
export type Event = z.infer<typeof Event>;
export type Person = z.infer<typeof Person>;
export type Location = z.infer<typeof Location>;
export type Journey = z.infer<typeof Journey>;
export type RegionFeature = z.infer<typeof RegionFeature>;
export type RegionCollection = z.infer<typeof RegionCollection>;
