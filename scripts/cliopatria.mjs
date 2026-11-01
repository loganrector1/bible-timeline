// Builds src/data/borders/cliopatria.json, the great powers' outlines over time, from Cliopatria
// (the Seshat Global History Databank's polity borders, CC BY 4.0,
// github.com/Seshat-Global-History-Databank/cliopatria). Each power in POWERS takes the named
// Cliopatria polities, cut to its dates in empires.json: the first and last snapshots are
// stretched to the empire's start and end, gaps inside are kept (Egypt under Persia). A power's
// polities are merged into one shape, a power gives up land another holds where history says so
// (`yieldTo`), and the shapes are simplified for the map and given a label point. Overlaps left
// between powers are reported, to be checked against history.
//
//   node scripts/cliopatria.mjs              rebuild from the cached download
//   node scripts/cliopatria.mjs --refresh    download Cliopatria again first
//
// The data (46 MB zipped, 170 MB unzipped) is cached in node_modules/.cache/cliopatria.
// Israel's own outlines, and anything Cliopatria lacks, are drawn by hand in borders/drawn.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import polygonClipping from "polygon-clipping";
import { unzip } from "./unzip.mjs";

const URL = "https://github.com/Seshat-Global-History-Databank/cliopatria/raw/main/cliopatria.geojson.zip";
const CACHE = join("node_modules", ".cache", "cliopatria", "cliopatria.geojson.zip");
const OUT = join("src", "data", "borders", "cliopatria.json");
const EMPIRES = join("src", "data", "empires.json");
/** Simplification tolerance in degrees (about 4 km): borders this old are rougher than that. */
const TOLERANCE = 0.04;
/** Rings smaller than this (square degrees) are dropped: islets the map can't show. */
const MIN_RING_AREA = 0.004;
/** Overlaps between two powers bigger than this (square degrees) are reported. */
const REPORT_OVERLAP = 0.5;

/**
 * Which Cliopatria polities make up each power. `empire` ties it to empires.json (and its dates);
 * `from`/`to` narrow those (or bound a power with no empire, whose `links` say what it belongs
 * to). `until` cuts one polity short where Cliopatria runs it on past a conquest, and `since`
 * starts one earlier where its first snapshot comes late. `yieldTo` names powers whose land this
 * one's outline gives up while both stand. `province` splits off the land a power held beyond
 * its homeland, drawn lighter (`subject`), as the lands subject to David are. `tint` colours
 * Israel's own states as the Kings lane does (Judah warm).
 */
// Where one power ends the year the next begins (empires.json), the year goes to the next.
const POWERS = [
  { empire: "egypt-middle", name: "Egypt", rows: ["Middle Kingdom of Egypt"], to: -1649, province: "asia" },
  { empire: "old-babylon", name: "Babylon", rows: ["Babylonia"] },
  // Cliopatria's Delta dynasties start at 1600 BC; the Hyksos held the Delta from about 1650.
  {
    empire: "hyksos", name: "Hyksos", to: -1549,
    rows: ["Hyksos", "Fifteenth Dynasty of Egypt", "Sixteenth Dynasty of Egypt"],
    since: { "Fifteenth Dynasty of Egypt": -1649, "Sixteenth Dynasty of Egypt": -1649 },
  },
  // Egyptian kings held the south from Thebes meanwhile (the 17th dynasty), until Ahmose drove
  // the Hyksos out and began the New Kingdom.
  {
    id: "thebes", name: "Egypt (Thebes)", rows: ["Seventeenth Dynasty of Egypt"], from: -1649, to: -1549,
    since: { "Seventeenth Dynasty of Egypt": -1649 }, links: [{ kind: "empire", id: "hyksos" }],
  },
  { empire: "hittites", name: "Hittites", rows: ["Hittites"] },
  { empire: "egypt-new", name: "Egypt", rows: ["New Kingdom of Egypt"], to: -1069, province: "asia" },
  // Until Esarhaddon took Memphis in 671 BC; Assyria held Egypt until Psamtik I threw it off,
  // about 656 BC. Cliopatria keeps Egypt in Assyria's outline until 616.
  {
    empire: "egypt-divided", name: "Egypt", to: -670, province: "asia",
    rows: ["New Kingdom of Egypt", "Twenty-second Dynasty of Egypt", "Twenty-third Dynasty of Egypt"],
  },
  // Babylon broke away under Nabopolassar in 626 BC; Cliopatria keeps it Assyrian until 616.
  { empire: "assyria", name: "Assyria", rows: ["Neo-Assyrian Empire"], yieldTo: ["egypt-divided", "egypt-late", "babylon"] },
  // The 26th dynasty fell to Cambyses in 525 BC; the 30th to Artaxerxes III in 343 BC.
  {
    empire: "egypt-late", name: "Egypt", from: -655, to: -342, province: "asia",
    rows: ["Twenty-sixth Dynasty of Egypt", "Thirtieth Dynasty of Egypt"], until: { "Twenty-sixth Dynasty of Egypt": -524 },
  },
  { empire: "babylon", name: "Babylon", rows: ["Babylonia", "Neo-Babylonian Empire"], until: { Babylonia: -599 } },
  { empire: "persia", name: "Persia", rows: ["Achaemenid Empire"] },
  { empire: "alexander-empire", name: "Alexander's empire", rows: ["Macedonian Empire"] },
  // Rome took Syria in 64–63 BC and Egypt in 30 BC.
  { empire: "seleucids", name: "Seleucids", rows: ["Seleucid Empire"], yieldTo: ["roman-republic"] },
  { empire: "ptolemies", name: "Ptolemies", rows: ["Ptolemaic Kingdom"], yieldTo: ["roman-republic"], province: "asia" },
  { empire: "hasmoneans", name: "Hasmoneans", rows: ["Judea"], tint: "judah" },
  { empire: "roman-republic", name: "Rome", rows: ["Roman Republic"], to: -26 },
  // The timeline ends soon after AD 100.
  { empire: "rome", name: "Rome", rows: ["Roman Empire"], to: 200 },
  // Herod's kingdom, a Roman client, from the year after he took Jerusalem (37 BC), when the
  // Hasmoneans end, to his death (4 BC).
  { id: "herod", name: "Herod's kingdom", rows: ["Judea"], from: -35, to: -3, links: [{ kind: "person", id: "herod-the-great" }], tint: "judah" },
];

/**
 * Lands beyond a homeland, for `province`. "asia": Canaan and Syria, east of Egypt's frontier
 * (Rafah to the head of the Gulf of Aqaba) and of a line off the Levant coast, so Sinai and
 * Cyprus aren't counted in it.
 */
const PROVINCES = {
  asia: [[[[34.22, 31.32], [34.9, 29.5], [35.2, 25], [60, 25], [60, 45], [35.9, 45], [35.9, 36.9], [35.5, 35.9], [35.4, 34.5], [34.7, 33.5], [34.2, 32.5], [34.22, 31.32]]]],
};

const zip = await load(process.argv.includes("--refresh"));
console.log("Reading Cliopatria…");
const geojson = [...unzip(zip)].find(([name]) => name.endsWith(".geojson") && !name.includes("/."));
if (!geojson) throw new Error("no .geojson in the Cliopatria zip");
const clio = JSON.parse(geojson[1].toString("utf8"));
const empires = new Map(JSON.parse(readFileSync(EMPIRES, "utf8")).map((e) => [e.id, e]));

const features = [];
for (const power of POWERS) {
  let lo = power.from, hi = power.to;
  if (power.empire) {
    const e = empires.get(power.empire);
    if (!e) throw new Error(`no empire ${power.empire}`);
    // Bounds cover whole years, as the timeline's do: a span "549–329 BC" lasts to the end of 329.
    lo = Math.max(e.dates.early.start.year, power.from ?? -Infinity);
    hi = Math.min(e.dates.early.end.year + 1, power.to ?? Infinity);
  }
  // Cliopatria's rows run FromYear to ToYear inclusive.
  const rows = clio.features
    .filter((f) => power.rows.includes(f.properties.Name))
    .map((f) => ({
      geometry: f.geometry,
      from: power.since?.[f.properties.Name] ?? f.properties.FromYear,
      to: Math.min(f.properties.ToYear + 1, power.until?.[f.properties.Name] ?? Infinity),
    }))
    .filter((r) => r.to > lo && r.from < hi && r.from < r.to);
  if (rows.length === 0) throw new Error(`nothing in Cliopatria for ${power.empire ?? power.id}`);

  // Split time wherever a row starts or ends, and take the rows covering each piece.
  const cuts = [...new Set(rows.flatMap((r) => [r.from, r.to]).concat(lo, hi))]
    .filter((y) => y >= lo && y <= hi)
    .sort((a, b) => a - b);
  const pieces = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [a, b] = [cuts[i], cuts[i + 1]];
    const covering = rows.filter((r) => r.from < b && r.to > a);
    if (covering.length === 0) continue;
    const prev = pieces.at(-1);
    if (prev && prev.to === a && sameRows(prev.rows, covering)) prev.to = b;
    else pieces.push({ from: a, to: b, rows: covering });
  }
  // Stretch the first and last snapshots to the power's own start and end.
  pieces[0].from = lo;
  pieces.at(-1).to = hi;

  const key = power.empire ?? power.id;
  for (const p of pieces) {
    // One shape per power: the polities' shared borders ("Egypt divided") aren't drawn.
    const merged = p.rows.length === 1 ? multi(p.rows[0].geometry) : polygonClipping.union(...p.rows.map((r) => multi(r.geometry)));
    const coordinates = merged.map(simplifyPolygon).filter(Boolean);
    if (coordinates.length === 0) continue;
    features.push({ key, power, from: p.from, to: p.to, coordinates });
  }
}

// A power gives up the land of those it yields to, while both stand.
const final = features.flatMap((f) => {
  const others = features.filter((o) => f.power.yieldTo?.includes(o.key) && o.from < f.to && o.to > f.from);
  if (others.length === 0) return [f];
  const cuts = [...new Set([f.from, f.to, ...others.flatMap((o) => [o.from, o.to])])]
    .filter((y) => y >= f.from && y <= f.to)
    .sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [a, b] = [cuts[i], cuts[i + 1]];
    const over = others.filter((o) => o.from < b && o.to > a);
    const left = over.length ? polygonClipping.difference(f.coordinates, ...over.map((o) => o.coordinates)) : f.coordinates;
    const coordinates = left.map(dropSmall).filter(Boolean);
    if (coordinates.length) out.push({ ...f, from: a, to: b, coordinates });
  }
  return out;
});

reportOverlaps(final);

// A power's land beyond its homeland is a separate, lighter outline (Egypt's province in Canaan),
// so Israel's drawn outlines over it stay clear.
const split = final.flatMap((f) => {
  const beyond = f.power.province && PROVINCES[f.power.province];
  if (!beyond) return [f];
  const home = polygonClipping.difference(f.coordinates, beyond).map(dropSmall).filter(Boolean);
  const away = polygonClipping.intersection(f.coordinates, beyond).map(dropSmall).filter(Boolean);
  return [
    ...(home.length ? [{ ...f, coordinates: home }] : []),
    ...(away.length ? [{ ...f, key: `${f.key}-province`, subject: true, coordinates: away }] : []),
  ];
});

const geojson_ = split.map((f) => ({
  type: "Feature",
  properties: {
    id: `${f.key}@${f.from}`,
    name: f.power.name,
    ...(f.power.empire ? { empire: f.power.empire } : { links: f.power.links }),
    ...(f.power.tint && { tint: f.power.tint }),
    ...(f.subject && { subject: true, small: true }),
    from: f.from,
    to: f.to,
    label: labelPoint(f.coordinates),
  },
  geometry: f.coordinates.length === 1
    ? { type: "Polygon", coordinates: f.coordinates[0] }
    : { type: "MultiPolygon", coordinates: f.coordinates },
}));

mkdirSync(dirname(OUT), { recursive: true });
// One feature per line keeps diffs readable.
writeFileSync(
  OUT,
  `{"type":"FeatureCollection","features":[\n${geojson_.map((f) => JSON.stringify(f)).join(",\n")}\n]}\n`,
);
console.log(`${geojson_.length} outlines, ${Math.round(readFileSync(OUT).length / 1024)} KB → ${OUT}`);

/** A geometry as MultiPolygon coordinates. */
function multi(g) {
  return g.type === "Polygon" ? [g.coordinates] : g.coordinates;
}

/** A polygon without the slivers and islets a cut can leave, or null if nothing's left. */
function dropSmall(rings) {
  const kept = rings.filter((r) => Math.abs(ringArea(r)) >= MIN_RING_AREA);
  return kept.length && kept[0] === rings[0] ? kept : null;
}

/** Prints overlaps between different powers' outlines that stand at the same time. */
function reportOverlaps(fs) {
  const box = (f) => {
    const pts = f.coordinates.flatMap((p) => p[0]);
    return [Math.min(...pts.map((c) => c[0])), Math.min(...pts.map((c) => c[1])), Math.max(...pts.map((c) => c[0])), Math.max(...pts.map((c) => c[1]))];
  };
  const boxes = new Map(fs.map((f) => [f, box(f)]));
  for (let i = 0; i < fs.length; i++) {
    for (let j = i + 1; j < fs.length; j++) {
      const [a, b] = [fs[i], fs[j]];
      if (a.key === b.key || a.from >= b.to || b.from >= a.to) continue;
      const [p, q] = [boxes.get(a), boxes.get(b)];
      if (p[0] > q[2] || q[0] > p[2] || p[1] > q[3] || q[1] > p[3]) continue;
      const area = polygonClipping.intersection(a.coordinates, b.coordinates)
        .reduce((s, poly) => s + Math.abs(ringArea(poly[0])) - poly.slice(1).reduce((h, r) => h + Math.abs(ringArea(r)), 0), 0);
      if (area > REPORT_OVERLAP) {
        console.log(`overlap ${area.toFixed(1)} sq°: ${a.key} and ${b.key}, ${Math.max(a.from, b.from)} to ${Math.min(a.to, b.to)}`);
      }
    }
  }
}

function sameRows(a, b) {
  return a.length === b.length && a.every((r) => b.includes(r));
}

async function load(refresh) {
  if (refresh || !existsSync(CACHE)) {
    console.log(`Downloading ${URL}…`);
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    mkdirSync(dirname(CACHE), { recursive: true });
    writeFileSync(CACHE, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(CACHE);
}

function round(c) {
  return [Math.round(c[0] * 1000) / 1000, Math.round(c[1] * 1000) / 1000];
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  return a / 2;
}

/** Douglas–Peucker on one ring; null if what's left is too small to see. */
function simplifyRing(ring) {
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let max = 0, idx = -1;
    const [ax, ay] = ring[s], [bx, by] = ring[e];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = ring[i];
      const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
      if (d > max) [max, idx] = [d, i];
    }
    if (max > TOLERANCE) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    if (!keep[i]) continue;
    const c = round(ring[i]);
    const last = out.at(-1);
    if (!last || last[0] !== c[0] || last[1] !== c[1]) out.push(c);
  }
  if (out.length < 4 || Math.abs(ringArea(out)) < MIN_RING_AREA) return null;
  return out;
}

function simplifyPolygon(rings) {
  const outer = simplifyRing(rings[0]);
  if (!outer) return null;
  return [outer, ...rings.slice(1).map(simplifyRing).filter(Boolean)];
}

function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToRing(pt, ring) {
  let min = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j], [bx, by] = ring[i];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / len2)) : 0;
    min = Math.min(min, Math.hypot(pt[0] - ax - t * dx, pt[1] - ay - t * dy));
  }
  return min;
}

/** A point well inside the largest polygon, for the label: the grid point farthest from its edges. */
function labelPoint(polys) {
  const largest = polys.reduce((a, b) => (Math.abs(ringArea(b[0])) > Math.abs(ringArea(a[0])) ? b : a));
  const xs = largest[0].map((c) => c[0]), ys = largest[0].map((c) => c[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let best = largest[0][0], bestD = -1;
  const N = 40;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const pt = [x0 + ((x1 - x0) * i) / N, y0 + ((y1 - y0) * j) / N];
      if (!inRing(pt, largest[0]) || largest.slice(1).some((h) => inRing(pt, h))) continue;
      const d = Math.min(...largest.map((r) => distToRing(pt, r)));
      if (d > bestD) [best, bestD] = [pt, d];
    }
  }
  return round(best);
}
