import { erasById, eventsById, locationsById, peopleById, toursById, type EntityKind, type EntityRef } from "../data";
import { CHRONOLOGIES, DEFAULT_CHRONOLOGY } from "../data/chronologies";
import { EventType } from "../data/schema";
import type { ViewMode } from "../state/store";
import { fromHistorical, toHistorical } from "./dates";
import type { Filters } from "./filters";
import { formatPassageParam, parsePassage, type Passage } from "./passages";

/**
 * What a link restores: `?event=exodus&year=1446.5BC&zoom=12&view=map&types=battle,miracle&people=david`,
 * or `?passage=Exod.12-14` (OSIS, comma-separated; the reading-plans app links this way), and
 * `chron=late` when it isn't the default chronology (the one its year was written in), and
 * `tour=exodus&step=3` (counting from 1) for a guided tour.
 * Every part is optional. Keep these names stable once published: links get pasted into lesson notes.
 */
export type LinkState = {
  mode?: ViewMode;
  selection?: EntityRef;
  year?: number;
  pxPerYear?: number;
  filters?: Filters;
  chronology?: string;
  /** Step counts from 0 here, from 1 in the link. */
  tour?: { id: string; step: number };
};

/** The URL parameter for each kind of selection. */
const KIND_PARAM: Record<EntityKind, string> = { event: "event", person: "person", location: "place", era: "era" };
const BY_ID: Record<EntityKind, Map<string, unknown>> = {
  event: eventsById, person: peopleById, location: locationsById, era: erasById,
};
const VIEWS: ViewMode[] = ["timeline", "split", "map"];

/**
 * A year as people write it, with the fraction of the year after the point: astronomical
 * -1445.5 is "1446.5BC" (halfway through 1446 BC), 30.25 is "30.25AD". `digits` is how
 * many decimals the zoom calls for.
 */
export function formatYearParam(year: number, digits: number): string {
  const whole = Math.floor(year);
  const { n, bc } = toHistorical(whole);
  const frac = (year - whole).toFixed(digits).replace(/\.?0+$/, "");
  // Rounding up to a whole year carries into the next one.
  if (frac === "1") return formatYearParam(whole + 1, 0);
  return `${n}${frac === "0" ? "" : frac.slice(1)}${bc ? "BC" : "AD"}`;
}

/** Reads "1446BC", "1446.5bc", "AD30", "30 ad", "30.25AD" or a bare astronomical year ("-1445.5"). */
export function parseYearParam(s: string): number | undefined {
  const t = s.trim().toUpperCase().replace(/\s+/g, "");
  const m = /^(?:(AD|CE)?(\d+)(\.\d+)?(BC|BCE|AD|CE)?)$/.exec(t);
  if (m && !(m[1] && m[4])) {
    const n = Number(m[2]);
    if (n < 1) return undefined; // There's no year 0.
    const bc = m[4] === "BC" || m[4] === "BCE";
    return fromHistorical(n, bc) + Number(m[3] ?? 0);
  }
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return undefined;
}

export function parseLink(search: string): LinkState {
  const p = new URLSearchParams(search);
  const out: LinkState = {};
  const view = p.get("view");
  if (view && (VIEWS as string[]).includes(view)) out.mode = view as ViewMode;
  for (const kind of Object.keys(KIND_PARAM) as EntityKind[]) {
    const id = p.get(KIND_PARAM[kind]);
    if (id && BY_ID[kind].has(id)) {
      out.selection = { kind, id };
      break;
    }
  }
  const year = parseYearParam(p.get("year") ?? "");
  if (year !== undefined) out.year = year;
  const zoom = Number(p.get("zoom"));
  if (zoom > 0) out.pxPerYear = zoom;
  const tour = p.get("tour");
  if (tour && toursById.has(tour)) out.tour = { id: tour, step: Math.max(1, Math.floor(Number(p.get("step")) || 1)) - 1 };
  const chron = p.get("chron");
  if (chron && CHRONOLOGIES.some((c) => c.id === chron)) out.chronology = chron;
  const list = (name: string) => (p.get(name) ?? "").split(",").filter(Boolean);
  const types = list("types").filter((t): t is EventType => (EventType.options as string[]).includes(t));
  const people = list("people").filter((id) => peopleById.has(id));
  const passages = list("passage").map(parsePassage).filter((p): p is Passage => p !== undefined);
  const eras = list("eras").filter((id) => erasById.has(id));
  const places = list("places").filter((id) => locationsById.has(id));
  if (types.length || people.length || passages.length || eras.length || places.length) {
    out.filters = { types, people, passages, eras, places };
  }
  return out;
}

/**
 * The query string for a state, without the "?"; the default view ("Both") is left out, and
 * so is the year when there's none (opening the link then goes where selecting would).
 */
export function formatLink(
  s: Required<Pick<LinkState, "mode" | "pxPerYear">> & {
    selection: EntityRef | null; year?: number; filters?: Filters; chronology?: string;
    tour?: { id: string; step: number } | null;
  },
): string {
  const p = new URLSearchParams();
  if (s.selection) p.set(KIND_PARAM[s.selection.kind], s.selection.id);
  // Enough decimals that the cursor lands within a pixel of where it was.
  const digits = Math.min(5, Math.max(1, Math.ceil(Math.log10(s.pxPerYear))));
  if (s.year !== undefined) p.set("year", formatYearParam(s.year, digits));
  p.set("zoom", String(Number(s.pxPerYear.toPrecision(3))));
  if (s.mode !== "split") p.set("view", s.mode);
  if (s.chronology && s.chronology !== DEFAULT_CHRONOLOGY) p.set("chron", s.chronology);
  if (s.tour) {
    p.set("tour", s.tour.id);
    p.set("step", String(s.tour.step + 1));
  }
  if (s.filters?.types.length) p.set("types", s.filters.types.join(","));
  if (s.filters?.people.length) p.set("people", s.filters.people.join(","));
  if (s.filters?.passages.length) p.set("passage", s.filters.passages.map(formatPassageParam).join(","));
  if (s.filters?.eras.length) p.set("eras", s.filters.eras.join(","));
  if (s.filters?.places.length) p.set("places", s.filters.places.join(","));
  // Commas are safe in a query and easier to read than %2C.
  return p.toString().replace(/%2C/g, ",");
}
