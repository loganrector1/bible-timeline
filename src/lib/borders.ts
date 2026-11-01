import { BorderCollection, type BorderFeature } from "../data/schema";
import { empiresById, type EntityRef } from "../data";

let loading: Promise<BorderFeature[]> | undefined;

/**
 * The powers' outlines over time (`src/data/borders/`): Cliopatria's, built by
 * scripts/cliopatria.mjs, and Israel's, drawn by hand. Loaded on first use, since they're
 * most of a megabyte and only the map needs them.
 */
export function loadBorders(): Promise<BorderFeature[]> {
  loading ??= Promise.all([import("../data/borders/cliopatria.json"), import("../data/borders/drawn.json")]).then(
    ([clio, drawn]) => [...BorderCollection.parse(clio.default).features, ...BorderCollection.parse(drawn.default).features],
  );
  return loading;
}

/** When an outline shows under a chronology: from its first year until (not including) its last. */
export function borderYears(f: BorderFeature, chron: string): [number, number] {
  const p = f.properties;
  return chron === "late" ? [p.lateFrom ?? p.from, p.lateTo ?? p.to] : [p.from, p.to];
}

export function bordersAt(features: BorderFeature[], year: number, chron: string): BorderFeature[] {
  return features.filter((f) => {
    const [from, to] = borderYears(f, chron);
    return from <= year && year < to;
  });
}

/** One power's outlines share the part of their ids before the @ ("assyria@-750"). */
export function borderPower(f: BorderFeature): string {
  return f.properties.id.split("@")[0];
}

/** What an outline belongs to: its empire, then what it links to. Selecting any shows it strongly. */
export function borderTargets(f: BorderFeature): EntityRef[] {
  const p = f.properties;
  return [...(p.empire ? [{ kind: "empire" as const, id: p.empire }] : []), ...(p.links ?? [])];
}

/** What clicking an outline opens: the first thing it belongs to. */
export function borderTarget(f: BorderFeature): EntityRef | undefined {
  return borderTargets(f)[0];
}

/** Whether an outline belongs to an entity. */
export function borderOf(f: BorderFeature, ref: EntityRef): boolean {
  return borderTargets(f).some((t) => t.kind === ref.kind && t.id === ref.id);
}

/** The corners of an outline's bounding box, for framing it. */
export function borderBox(f: BorderFeature): [number, number][] {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const pts = polys.flatMap((p) => p[0]);
  const lons = pts.map((c) => c[0]), lats = pts.map((c) => c[1]);
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}

function inRing([x, y]: readonly number[], ring: readonly (readonly number[])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether a point lies inside an outline (and not in one of its holes). */
export function borderContains(f: BorderFeature, pt: readonly number[]): boolean {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  return polys.some((rings) => inRing(pt, rings[0]) && !rings.slice(1).some((hole) => inRing(pt, hole)));
}

/** One stretch of a place's "Ruled by": who held it, from when until (not including) when. */
export type Ruler = { name: string; target?: EntityRef; from: number; to: number; open: boolean };

/**
 * Who held a point, from the outlines that took it in, earliest first: the empires, and Israel's
 * own states (the tribes' allotments, Saul, the united kingdom, Judah, Yehud, Herod's kingdom…),
 * named as on the map. Adjacent outlines with one name are one stretch (Saul's Israel and
 * David's), opening what they share (the united kingdom); a power that lost the place and took
 * it back is listed once per stretch. `open` marks a stretch still running where the outlines
 * stop (Rome's are drawn only to AD 200).
 */
export function rulersOver(all: BorderFeature[], pt: readonly number[], chron: string): Ruler[] {
  // Where the outlines stop altogether. A power's own last outline isn't enough: many end
  // early on purpose, at a conquest (Egypt's to Assyria), and those stretches are closed.
  const end = Math.max(...all.map((f) => borderYears(f, chron)[1]));
  const spans = all
    .filter((f) => borderContains(f, pt))
    .map((f) => {
      const p = f.properties;
      const [from, to] = borderYears(f, chron);
      // The tribes' outlines are what Joshua allotted them, not what they held (Jebus, in
      // Benjamin's, stood until David), so they're named as allotments.
      const allotment = p.links?.[0]?.kind === "event";
      const name = p.empire ? empiresById.get(p.empire)?.name ?? p.empire : allotment ? `${p.name}'s allotment` : p.name;
      return { name, targets: borderTargets(f), from, to };
    })
    .sort((a, b) => a.from - b.from);
  const out: (typeof spans)[number][] = [];
  for (const s of spans) {
    const prev = out.findLast((o) => o.name === s.name);
    if (prev && s.from <= prev.to) {
      prev.to = Math.max(prev.to, s.to);
      const shared = prev.targets.filter((t) => s.targets.some((u) => u.kind === t.kind && u.id === t.id));
      if (shared.length) prev.targets = shared;
    } else out.push({ ...s });
  }
  return out.map(({ name, targets, from, to }) => ({ name, target: targets[0], from, to, open: to === end }));
}
