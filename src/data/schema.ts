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
  /**
   * History from outside Scripture (the fall of Nineveh, Pompey takes Jerusalem): shown only
   * while the World history lane is on, and drawn apart from Scripture's events.
   */
  world: z.boolean().default(false),
  scripture: z.array(ScriptureRef).default([]),
});

/**
 * Which lane of the timeline a person's bar sits in: the main figures, or one of the optional
 * groups (off by default) that would crowd the main lane.
 */
export const Lane = z.enum(["people", "kings", "prophets", "church", "world"]);
export type Lane = z.infer<typeof Lane>;

/** The throne a king of God's people sat on, which sets his column and color in the Kings lane. */
export const Kingdom = z.enum(["united", "judah", "israel"]);

export const Person = z.object({
  id,
  name: z.string(),
  altNames: z.array(z.string()).default([]),
  /** Women are marked in the family tree, so a mother's line reads apart from a father's. */
  female: z.boolean().default(false),
  roles: z.array(z.string()).default([]),
  lane: Lane.default("people"),
  /** Other lanes they belong to (Peter is also church). They show once, in the first lane that's on. */
  alsoIn: z.array(Lane).default([]),
  /**
   * No "known c." bar, for supporting figures whose events crowd a busy stretch (Laban, Leah,
   * Rachel, Esau around 1913 BC set the people lane's width everywhere). Only for people without `dates`.
   */
  noBar: z.boolean().default(false),
  summary: z.string(),
  /**
   * Lifespan where Scripture supports one; otherwise the years we can place them (a reign, a
   * ministry), said so in `dateNote`. Without it, the bar spans the person's events.
   */
  dates: Dates.optional(),
  dateNote: z.string().optional(),
  /**
   * For kings: the years they reigned alone (Thiele), their bar in the Kings lane. Only when it
   * differs from `dates`, which is then a lifespan or a reign counted from a coregency.
   */
  reign: Dates.optional(),
  kingdom: Kingdom.optional(),
  /** For rulers in the World history lane: the empire they ruled, or ruled for (Pilate, Rome). */
  empire: id.optional(),
  /** Person or genealogy-name ids (`genealogy.json`), here and in `altParents` and `spouses`. */
  parents: ids,
  /** The other Gospel's line, where Matthew and Luke name different fathers (Joseph: Jacob or Heli). */
  altParents: ids,
  spouses: ids,
  /** How Scripture relates them, where it needs saying (Jesus and Joseph, Jesus' brothers). */
  familyNote: z.string().optional(),
  scripture: z.array(ScriptureRef).default([]),
});

/**
 * A name from the genealogies (Seth, Obed, Luke's Heli) that links the family tree but gets no
 * person entry: no bar, no Browse row, no panel. Shown only in the family tree.
 */
export const GenealogyName = z.object({
  id,
  name: z.string(),
  female: z.boolean().default(false),
  parents: ids,
  altParents: ids,
  spouses: ids,
  scripture: z.array(ScriptureRef).default([]),
  note: z.string().optional(),
});

/**
 * A great power of the world around Israel (Assyria, Persia, Rome), drawn as a bar in the World
 * history lane. Dated from history, so its dates don't change with the chronology.
 */
export const Empire = z.object({
  id,
  name: z.string(),
  summary: z.string(),
  dates: Dates,
  dateNote: z.string().optional(),
  /** Where it was ruled from, as far as our places go. */
  capitals: ids,
  /** Its column in the World history lane, so a line of powers (Egypt's, Mesopotamia's) stays in one. */
  column: z.number().int().min(0).optional(),
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

/**
 * A guided tour: steps that each select an event, with a line or two of narration tying it to
 * the story. The details panel shows the narration while the step's event is selected.
 */
export const Tour = z.object({
  id,
  title: z.string(),
  summary: z.string(),
  steps: z.array(z.object({ event: z.string(), text: z.string() })).min(2),
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

/**
 * One dated outline of a power on the map (`borders/`): an empire from Cliopatria, or Israel's
 * own states drawn by hand. It shows from `from` until `to` (astronomical years, `to` excluded);
 * `lateFrom`/`lateTo` replace them under the late chronology, for outlines tied to the Exodus.
 * Selecting it opens its `empire`, or else its first link.
 */
export const BorderFeature = z.object({
  type: z.literal("Feature"),
  properties: z.object({
    /** Unique; Cliopatria's are "‹power›@‹from›", so one power's outlines share what's before the @. */
    id: z.string().regex(/^[a-z0-9-]+(@-?\d+)?$/),
    /** The map label. */
    name: z.string(),
    empire: id.optional(),
    /** What else it belongs to (a king, an era); selecting any of them shows it strongly. */
    links: z.array(z.object({ kind: z.enum(["person", "era", "empire", "event", "location"]), id })).optional(),
    from: z.number().int(),
    to: z.number().int(),
    lateFrom: z.number().int().optional(),
    lateTo: z.number().int().optional(),
    label: Coords,
    /** How sure the outline is, and what it shows; drawn outlines always say. */
    note: z.string().optional(),
    /** Israel's own states take the Kings lane's tints: Judah warm, Israel cool, the united kingdom plain; its neighbors share one. */
    tint: z.enum(["judah", "israel", "united", "neighbor"]).optional(),
    /** Lands that paid tribute rather than being ruled: drawn fainter, dashed. */
    subject: z.boolean().optional(),
    /** A smaller label, for tribes and provinces. */
    small: z.boolean().optional(),
  }),
  geometry: z.union([
    z.object({ type: z.literal("Polygon"), coordinates: z.array(Ring) }),
    z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.array(Ring)) }),
  ]),
});

export const BorderCollection = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(BorderFeature),
});

// TimePoint and DateSpec types live in lib/dates.ts; these schemas match them.
export type ScriptureRef = z.infer<typeof ScriptureRef>;
export type Era = z.infer<typeof Era>;
export type Empire = z.infer<typeof Empire>;
export type EventType = z.infer<typeof EventType>;
export type Event = z.infer<typeof Event>;
export type Person = z.infer<typeof Person>;
export type GenealogyName = z.infer<typeof GenealogyName>;
export type Location = z.infer<typeof Location>;
export type Tour = z.infer<typeof Tour>;
export type Journey = z.infer<typeof Journey>;
export type RegionFeature = z.infer<typeof RegionFeature>;
export type RegionCollection = z.infer<typeof RegionCollection>;
export type BorderFeature = z.infer<typeof BorderFeature>;
export type BorderCollection = z.infer<typeof BorderCollection>;
