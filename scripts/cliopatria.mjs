// Builds src/data/borders/cliopatria.json, the great powers' outlines over time, from Cliopatria
// (the Seshat Global History Databank's polity borders, CC BY 4.0,
// github.com/Seshat-Global-History-Databank/cliopatria). Each power in POWERS takes the named
// Cliopatria polities, cut to its dates in empires.json: the first and last snapshots are
// stretched to the empire's start and end, gaps inside are kept (Egypt under Persia). Shapes are
// simplified for the map and given a label point.
//
//   node scripts/cliopatria.mjs              rebuild from the cached download
//   node scripts/cliopatria.mjs --refresh    download Cliopatria again first
//
// The data (46 MB zipped, 170 MB unzipped) is cached in node_modules/.cache/cliopatria.
// Israel's own outlines, and anything Cliopatria lacks, are drawn by hand in borders/drawn.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { inflateRawSync } from "node:zlib";

const URL = "https://github.com/Seshat-Global-History-Databank/cliopatria/raw/main/cliopatria.geojson.zip";
const CACHE = join("node_modules", ".cache", "cliopatria", "cliopatria.geojson.zip");
const OUT = join("src", "data", "borders", "cliopatria.json");
const EMPIRES = join("src", "data", "empires.json");
/** Simplification tolerance in degrees (about 4 km): borders this old are rougher than that. */
const TOLERANCE = 0.04;
/** Rings smaller than this (square degrees) are dropped: islets the map can't show. */
const MIN_RING_AREA = 0.004;

/**
 * Which Cliopatria polities make up each power. `empire` ties it to empires.json (and its dates);
 * otherwise `from`/`to` bound it (`to` alone cuts an empire short) and `links` say what it belongs to. `until` cuts one
 * polity short where Cliopatria runs it on past a conquest. `tint` colours Israel's own states
 * as the Kings lane does (Judah warm).
 */
const POWERS = [
  { empire: "egypt-middle", name: "Egypt", rows: ["Middle Kingdom of Egypt"] },
  { empire: "old-babylon", name: "Babylon", rows: ["Babylonia"] },
  { empire: "hyksos", name: "Hyksos", rows: ["Hyksos"] },
  { empire: "hittites", name: "Hittites", rows: ["Hittites"] },
  { empire: "egypt-new", name: "Egypt", rows: ["New Kingdom of Egypt"] },
  {
    empire: "egypt-divided", name: "Egypt",
    rows: ["New Kingdom of Egypt", "Twenty-second Dynasty of Egypt", "Twenty-third Dynasty of Egypt"],
  },
  { empire: "assyria", name: "Assyria", rows: ["Neo-Assyrian Empire"] },
  // The 26th dynasty fell to Cambyses in 525 BC.
  { empire: "egypt-late", name: "Egypt", rows: ["Twenty-sixth Dynasty of Egypt", "Thirtieth Dynasty of Egypt"], until: { "Twenty-sixth Dynasty of Egypt": -524 } },
  { empire: "babylon", name: "Babylon", rows: ["Babylonia", "Neo-Babylonian Empire"], until: { Babylonia: -599 } },
  { empire: "persia", name: "Persia", rows: ["Achaemenid Empire"] },
  { empire: "alexander-empire", name: "Alexander's empire", rows: ["Macedonian Empire"] },
  { empire: "seleucids", name: "Seleucids", rows: ["Seleucid Empire"] },
  { empire: "ptolemies", name: "Ptolemies", rows: ["Ptolemaic Kingdom"] },
  { empire: "hasmoneans", name: "Hasmoneans", rows: ["Judea"], tint: "judah" },
  { empire: "roman-republic", name: "Rome", rows: ["Roman Republic"] },
  // The timeline ends soon after AD 100.
  { empire: "rome", name: "Rome", rows: ["Roman Empire"], to: 200 },
  // Herod's kingdom, a Roman client, from the year after he took Jerusalem (37 BC), when the
  // Hasmoneans end, to his death (4 BC).
  { id: "herod", name: "Herod's kingdom", rows: ["Judea"], from: -35, to: -3, links: [{ kind: "person", id: "herod-the-great" }], tint: "judah" },
];

const zip = await load(process.argv.includes("--refresh"));
console.log("Reading Cliopatria…");
const clio = JSON.parse(unzipOnly(zip));
const empires = new Map(JSON.parse(readFileSync(EMPIRES, "utf8")).map((e) => [e.id, e]));

const features = [];
for (const power of POWERS) {
  let lo = power.from, hi = power.to;
  if (power.empire) {
    const e = empires.get(power.empire);
    if (!e) throw new Error(`no empire ${power.empire}`);
    // Bounds cover whole years, as the timeline's do: a span "549–329 BC" lasts to the end of 329.
    lo = e.dates.early.start.year;
    hi = Math.min(e.dates.early.end.year + 1, power.to ?? Infinity);
  }
  // Cliopatria's rows run FromYear to ToYear inclusive.
  const rows = clio.features
    .filter((f) => power.rows.includes(f.properties.Name))
    .map((f) => ({
      geometry: f.geometry,
      from: f.properties.FromYear,
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
    const polys = p.rows.flatMap((r) => (r.geometry.type === "Polygon" ? [r.geometry.coordinates] : r.geometry.coordinates));
    const coordinates = polys.map(simplifyPolygon).filter(Boolean);
    if (coordinates.length === 0) continue;
    features.push({
      type: "Feature",
      properties: {
        id: `${key}@${p.from}`,
        name: power.name,
        ...(power.empire ? { empire: power.empire } : { links: power.links }),
        ...(power.tint && { tint: power.tint }),
        from: p.from,
        to: p.to,
        label: labelPoint(coordinates),
      },
      geometry: coordinates.length === 1 ? { type: "Polygon", coordinates: coordinates[0] } : { type: "MultiPolygon", coordinates },
    });
  }
}

mkdirSync(dirname(OUT), { recursive: true });
// One feature per line keeps diffs readable.
writeFileSync(
  OUT,
  `{"type":"FeatureCollection","features":[\n${features.map((f) => JSON.stringify(f)).join(",\n")}\n]}\n`,
);
console.log(`${features.length} outlines, ${Math.round(readFileSync(OUT).length / 1024)} KB → ${OUT}`);

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

/** The .geojson inside the zip, read from its central directory (no unzip tool needed). */
function unzipOnly(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (!name.endsWith(".geojson") || name.includes("/.")) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.subarray(start, start + size);
    return (method === 0 ? body : inflateRawSync(body)).toString("utf8");
  }
  throw new Error("no .geojson in the Cliopatria zip");
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
