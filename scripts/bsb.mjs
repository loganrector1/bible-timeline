// Builds the Bible text the details panel shows: the Berean Standard Bible (public domain since
// 2023, bereanbible.com), one file per book at src/data/bible/<OSIS id>.json, each an array of
// chapters, each an array of verses ("" where the BSB leaves a verse out, like Matthew 17:21).
// The app loads a book only when a reader opens a passage from it.
//
// Jesus' words are wrapped in braces ("{“Follow Me,”} Jesus told him"), which the BSB never uses,
// for the red letters. The plain text gives the words; the BSB's USFM edition, which marks his
// words, says which ones. Each marked stretch is found in the plain verse, so the text is
// exactly the plain edition's either way.
//
//   node scripts/bsb.mjs              rebuild from the cached download
//   node scripts/bsb.mjs --refresh    download the text again first
//
// The text (4 MB) and the USFM (5 MB zipped) are downloaded once to node_modules/.cache/bsb.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { unzip } from "./unzip.mjs";

const URL = "https://bereanbible.com/bsb.txt";
const CACHE = join("node_modules", ".cache", "bsb", "bsb.txt");
const USFM_URL = "https://bereanbible.com/bsb_usfm.zip";
const USFM_CACHE = join("node_modules", ".cache", "bsb", "bsb_usfm.zip");
const OUT = join("src", "data", "bible");

// The BSB's books, in its (canonical) order, as OSIS ids: the same ids as lib/passages.ts.
const IDS = [
  "Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth", "1Sam", "2Sam", "1Kgs", "2Kgs",
  "1Chr", "2Chr", "Ezra", "Neh", "Esth", "Job", "Ps", "Prov", "Eccl", "Song", "Isa", "Jer", "Lam",
  "Ezek", "Dan", "Hos", "Joel", "Amos", "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag", "Zech",
  "Mal", "Matt", "Mark", "Luke", "John", "Acts", "Rom", "1Cor", "2Cor", "Gal", "Eph", "Phil", "Col",
  "1Thess", "2Thess", "1Tim", "2Tim", "Titus", "Phlm", "Heb", "Jas", "1Pet", "2Pet", "1John",
  "2John", "3John", "Jude", "Rev",
];

// The same books as USFM book codes, in the same order.
const USFM = [
  "GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA", "1KI", "2KI", "1CH", "2CH",
  "EZR", "NEH", "EST", "JOB", "PSA", "PRO", "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS",
  "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT", "MRK", "LUK",
  "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT",
  "PHM", "HEB", "JAS", "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV",
];

for (const [url, cache] of [[URL, CACHE], [USFM_URL, USFM_CACHE]]) {
  if (!process.argv.includes("--refresh") && existsSync(cache)) continue;
  console.log(`Downloading ${url}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  mkdirSync(dirname(cache), { recursive: true });
  writeFileSync(cache, Buffer.from(await res.arrayBuffer()));
}

// Rows are "Genesis 1:1<tab>In the beginning…", after a credit line, a dedication and a header.
const books = new Map(); // book name → chapters
for (const line of readFileSync(CACHE, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
  const m = /^(.+) (\d+):(\d+)\t(.*)$/.exec(line);
  if (!m) continue;
  const [, name, chapter, verse, text] = m;
  if (!books.has(name)) books.set(name, []);
  const chapters = books.get(name);
  const verses = (chapters[Number(chapter) - 1] ??= []);
  verses[Number(verse) - 1] = text.trim();
}
if (books.size !== IDS.length) throw new Error(`Expected ${IDS.length} books, found ${books.size}`);

// Jesus' words in each verse, from the USFM: "\wj …\wj*" stretches, which can run on across verses.
const usfm = new Map([...unzip(readFileSync(USFM_CACHE))].map(([name, buf]) => [name.split("/").pop().slice(0, 3), buf.toString("utf8")]));
let marked = 0;
const missed = [];
[...books.values()].forEach((chapters, b) => {
  const src = usfm.get(USFM[b]);
  if (!src) throw new Error(`No USFM for ${USFM[b]}`);
  const words = wordsOfJesus(src);
  for (const [key, stretches] of words) {
    const [c, v] = key.split(":").map(Number);
    const text = chapters[c - 1]?.[v - 1];
    if (!text) continue;
    let out = "", from = 0;
    for (const stretch of stretches) {
      const found = locate(text, stretch, from);
      if (!found) {
        missed.push(`${IDS[b]} ${key}: ${stretch.slice(0, 40)}`);
        continue;
      }
      const [at, end] = found;
      out += `${text.slice(from, at)}{${text.slice(at, end)}}`;
      from = end;
    }
    // One span for stretches only spaces apart.
    chapters[c - 1][v - 1] = (out + text.slice(from)).replace(/\}(\s*)\{/g, "$1");
    marked++;
  }
});
if (missed.length) console.log(`Couldn't place ${missed.length} stretches of Jesus' words:\n  ${missed.join("\n  ")}`);

mkdirSync(OUT, { recursive: true });
[...books.values()].forEach((chapters, i) => {
  // No holes: a verse missing from the file is left out, like those the BSB omits.
  const full = Array.from(chapters, (verses = []) => Array.from(verses, (v) => v ?? ""));
  writeFileSync(join(OUT, `${IDS[i]}.json`), JSON.stringify(full) + "\n");
});
console.log(`Wrote ${books.size} books to ${OUT}, with Jesus' words marked in ${marked} verses`);

/**
 * Where a stretch of the USFM sits in the plain verse, from `from` on: [start, end), or null.
 * The two editions space dashes differently ("sisters — yes", "sisters—yes") and sometimes
 * differ on a quote mark at either end, so spaces are ignored, then quote marks at the ends.
 */
function locate(text, stretch, from) {
  const kept = [];
  for (let i = from; i < text.length; i++) if (!/\s/.test(text[i])) kept.push(i);
  const squeezed = kept.map((i) => text[i]).join("");
  // "[’’]" closes quotes the USFM supplies and the plain text leaves out.
  const bare = stretch.replace(/\[[‘’“”'"]*\]/g, "");
  for (const s of [bare, bare.replace(/^[‘’“”'"]+|[‘’“”'"]+$/g, "")]) {
    const want = s.replace(/\s+/g, "");
    const at = want ? squeezed.indexOf(want) : -1;
    if (at >= 0) return [kept[at], kept[at + want.length - 1] + 1];
  }
  return null;
}

/** "chapter:verse" → the stretches of Jesus' words in it, in order, as plain text. */
function wordsOfJesus(src) {
  // Footnotes and cross-references aren't in the plain text.
  const text = src.replace(/\\f .*?\\f\*/gs, "").replace(/\\x .*?\\x\*/gs, "");
  const words = new Map();
  let chapter = 0, verse = 0, inWj = false, current = "";
  const close = () => {
    const t = current.replace(/\\\+?[a-z0-9]+\*?/g, " ").replace(/\s+/g, " ").trim();
    if (inWj && t && verse) {
      const key = `${chapter}:${verse}`;
      words.set(key, [...(words.get(key) ?? []), t]);
    }
    current = "";
  };
  for (const m of text.matchAll(/\\c (\d+)|\\v (\d+) ?|\\wj\*|\\wj |[^\\]+|\\/g)) {
    if (m[1]) {
      close();
      chapter = +m[1];
      verse = 0;
    } else if (m[2]) {
      close();
      verse = +m[2];
    } else if (m[0] === "\\wj*") {
      close();
      inWj = false;
    } else if (m[0] === "\\wj ") {
      close();
      inWj = true;
    } else if (inWj) {
      current += m[0];
    }
  }
  return words;
}
