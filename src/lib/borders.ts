import { BorderCollection, type BorderFeature } from "../data/schema";
import type { EntityRef } from "../data";

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

/** What selecting an outline opens: its empire, or else what it links to. */
export function borderTarget(f: BorderFeature): EntityRef | undefined {
  const p = f.properties;
  return p.empire ? { kind: "empire", id: p.empire } : p.link;
}

/** The corners of an outline's bounding box, for framing it. */
export function borderBox(f: BorderFeature): [number, number][] {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  const pts = polys.flatMap((p) => p[0]);
  const lons = pts.map((c) => c[0]), lats = pts.map((c) => c[1]);
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}
