// Builds the Bible text the details panel shows: the Berean Standard Bible (public domain since
// 2023, bereanbible.com), one file per book at src/data/bible/<OSIS id>.json, each an array of
// chapters, each an array of verses ("" where the BSB leaves a verse out, like Matthew 17:21).
// The app loads a book only when a reader opens a passage from it.
//
//   node scripts/bsb.mjs              rebuild from the cached download
//   node scripts/bsb.mjs --refresh    download the text again first
//
// The text (4 MB) is downloaded once to node_modules/.cache/bsb.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const URL = "https://bereanbible.com/bsb.txt";
const CACHE = join("node_modules", ".cache", "bsb", "bsb.txt");
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

if (process.argv.includes("--refresh") || !existsSync(CACHE)) {
  console.log(`Downloading ${URL}…`);
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`${URL}: ${res.status}`);
  mkdirSync(dirname(CACHE), { recursive: true });
  writeFileSync(CACHE, await res.text());
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

mkdirSync(OUT, { recursive: true });
[...books.values()].forEach((chapters, i) => {
  // No holes: a verse missing from the file is left out, like those the BSB omits.
  const full = Array.from(chapters, (verses = []) => Array.from(verses, (v) => v ?? ""));
  writeFileSync(join(OUT, `${IDS[i]}.json`), JSON.stringify(full) + "\n");
});
console.log(`Wrote ${books.size} books to ${OUT}`);
