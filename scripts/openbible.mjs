// Checks place coordinates against OpenBible.info's Bible geocoding data (CC BY 4.0,
// github.com/openbibleinfo/Bible-Geocoding-Data). Each location's `openbible` field names
// its OpenBible place ("Bethel 1"), and which of its candidate sites we follow when it isn't
// OpenBible's first choice ("Rephidim#2", the traditional site).
//
//   node scripts/openbible.mjs                 report places that drift or look uncertain
//   node scripts/openbible.mjs --write         also move drifted points
//
// Regions, seas and wildernesses are skipped: their points are label positions chosen for the map.
//   node scripts/openbible.mjs find <text>     search OpenBible places by name
//   node scripts/openbible.mjs show <name>     every candidate site for one place
//
// The data (12 MB) is downloaded once to node_modules/.cache/openbible; --refresh fetches it again.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const URL = "https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/data/ancient.jsonl";
const CACHE = join("node_modules", ".cache", "openbible", "ancient.jsonl");
const LOCATIONS = join("src", "data", "locations.json");
/** Metres a point may drift from OpenBible's before it's reported. */
const DRIFT_M = 1500;
/** Candidates this close together count as one site when judging certainty. */
const SAME_SITE_M = 3000;
/** Below this OpenBible score (out of 1000) a site counts as uncertain. */
const SURE_SCORE = 600;
/** Label points for large areas are placed for the map, not taken from OpenBible. */
const AREA_TYPES = new Set(["region", "wilderness", "sea"]);

const args = process.argv.slice(2);
const places = await load(args.includes("--refresh"));

if (args[0] === "find") {
  const q = args.slice(1).join(" ").toLowerCase();
  for (const p of places.values()) {
    if (p.name.toLowerCase().includes(q)) console.log(`${p.name.padEnd(28)} ${p.firstVerse ?? ""}  ${describe(p.sites[0])}`);
  }
} else if (args[0] === "show") {
  const p = places.get(args.slice(1).join(" "));
  if (!p) throw new Error("no such place; try find");
  console.log(`${p.name} (${p.types.join(", ")}), first in ${p.firstVerse}`);
  for (const s of p.sites) console.log(`  ${describe(s)}`);
} else {
  check(args.includes("--write"));
}

function check(write) {
  const locations = JSON.parse(readFileSync(LOCATIONS, "utf8"));
  let moved = 0;
  for (const loc of locations) {
    if (!loc.openbible) {
      console.log(`${loc.id}: no openbible id`);
      continue;
    }
    // "Rephidim#2": we follow OpenBible's second-ranked site rather than its first.
    const [name, rank = "1"] = loc.openbible.split("#");
    const sites = places.get(name)?.sites ?? [];
    const site = sites[+rank - 1];
    if (!site?.lonlat) {
      console.log(`${loc.id}: "${loc.openbible}" not found in OpenBible data`);
      continue;
    }
    const notes = [];
    const drift = metres(loc.coords, site.lonlat);
    if (drift > DRIFT_M && !AREA_TYPES.has(loc.type)) {
      notes.push(`${(drift / 1000).toFixed(1)} km from ${site.desc} [${site.lonlat}]`);
      if (write) {
        loc.coords = site.lonlat.map((n) => Math.round(n * 1000) / 1000);
        moved++;
      }
    }
    // Neighbouring candidates (Qantir and Tell el-Daba for Rameses) are one site for us.
    const near = (s) => s.lonlat && metres(s.lonlat, site.lonlat) <= SAME_SITE_M;
    const score = sites.filter(near).reduce((sum, s) => sum + s.score, 0);
    const unsure = score < SURE_SCORE || sites.some((s) => !near(s) && s.score > score);
    if (unsure && !loc.uncertain) notes.push(`OpenBible is unsure (score ${score}); consider uncertain: true`);
    if (notes.length) console.log(`${loc.id}: ${notes.join("; ")}`);
  }
  if (write && moved) {
    writeFileSync(LOCATIONS, formatList(locations));
    console.log(`moved ${moved} places`);
  }
}

async function load(refresh) {
  if (refresh || !existsSync(CACHE)) {
    console.error("downloading OpenBible.info data…");
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);
    mkdirSync(dirname(CACHE), { recursive: true });
    writeFileSync(CACHE, await res.text());
  }
  const out = new Map();
  for (const line of readFileSync(CACHE, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (!r.friendly_id) continue;
    const sites = (r.identifications ?? []).map((i) => {
      const lonlat = i.resolutions?.[0]?.lonlat?.split(",").map(Number);
      return {
        desc: (i.description ?? "").replace(/<[^>]+>/g, ""),
        lonlat: lonlat?.length === 2 ? lonlat : undefined,
        score: i.score?.time_total ?? i.score?.vote_total ?? 0,
      };
    });
    out.set(r.friendly_id, { name: r.friendly_id, types: r.types ?? [], firstVerse: r.verses?.[0]?.readable, sites });
  }
  return out;
}

/** One entity per line, as the data files are written by hand. */
function formatList(items) {
  return `[\n${items.map((i) => `  ${inline(i)}`).join(",\n")}\n]\n`;
}

function inline(v) {
  if (Array.isArray(v)) return `[${v.map(inline).join(", ")}]`;
  if (v && typeof v === "object") return `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(", ")} }`;
  return JSON.stringify(v);
}

function describe(s) {
  return s ? `${s.desc} [${s.lonlat ?? "no point"}] score ${s.score}` : "no identification";
}

function metres([lon1, lat1], [lon2, lat2]) {
  const r = Math.PI / 180;
  const x = (lon2 - lon1) * r * Math.cos(((lat1 + lat2) / 2) * r);
  const y = (lat2 - lat1) * r;
  return Math.hypot(x, y) * 6371000;
}
