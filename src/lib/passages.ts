import type { ScriptureRef } from "../data/schema";

/**
 * A book, a chapter range or a verse range, like a `ScriptureRef` but with the book as its OSIS
 * id ("Exod") and the chapter optional (the whole book). Links write it the OSIS way:
 * `Exod`, `Exod.12-14`, `Gen.12.1-9`, `Exod.12.1-14.31`. That format is the contract the
 * reading-plans app links through, so keep it stable.
 */
export type Passage = { book: string; chapter?: number; verse?: number; endChapter?: number; endVerse?: number };

/** OSIS id, display name, and other spellings (lower case, no spaces or dots) people use. */
const BOOKS: [string, string, string[]][] = [
  ["Gen", "Genesis", ["ge", "gn"]], ["Exod", "Exodus", ["ex", "exo"]], ["Lev", "Leviticus", ["le", "lv"]],
  ["Num", "Numbers", ["nu", "nm", "nb"]], ["Deut", "Deuteronomy", ["dt", "de"]], ["Josh", "Joshua", ["jos", "jsh"]],
  ["Judg", "Judges", ["jdg", "jg", "jdgs"]], ["Ruth", "Ruth", ["ru", "rth"]],
  ["1Sam", "1 Samuel", ["1sa", "1s"]], ["2Sam", "2 Samuel", ["2sa", "2s"]],
  ["1Kgs", "1 Kings", ["1ki", "1k", "1kin"]], ["2Kgs", "2 Kings", ["2ki", "2k", "2kin"]],
  ["1Chr", "1 Chronicles", ["1ch", "1chron"]], ["2Chr", "2 Chronicles", ["2ch", "2chron"]],
  ["Ezra", "Ezra", ["ezr"]], ["Neh", "Nehemiah", ["ne"]], ["Esth", "Esther", ["est", "es"]], ["Job", "Job", ["jb"]],
  ["Ps", "Psalms", ["psalm", "psa", "pss", "psm"]], ["Prov", "Proverbs", ["pr", "prv", "pro"]],
  ["Eccl", "Ecclesiastes", ["ecc", "ec", "qoh"]],
  ["Song", "Song of Songs", ["songofsolomon", "sos", "so", "canticles", "sng"]],
  ["Isa", "Isaiah", ["is"]], ["Jer", "Jeremiah", ["je", "jr"]], ["Lam", "Lamentations", ["la"]],
  ["Ezek", "Ezekiel", ["eze", "ezk"]], ["Dan", "Daniel", ["da", "dn"]], ["Hos", "Hosea", ["ho"]],
  ["Joel", "Joel", ["jl"]], ["Amos", "Amos", ["am"]], ["Obad", "Obadiah", ["ob", "oba"]], ["Jonah", "Jonah", ["jon", "jnh"]],
  ["Mic", "Micah", ["mi"]], ["Nah", "Nahum", ["na"]], ["Hab", "Habakkuk", ["hb"]], ["Zeph", "Zephaniah", ["zep", "zp"]],
  ["Hag", "Haggai", ["hg"]], ["Zech", "Zechariah", ["zec", "zc"]], ["Mal", "Malachi", ["ml"]],
  ["Matt", "Matthew", ["mt", "mat"]], ["Mark", "Mark", ["mk", "mrk", "mr"]], ["Luke", "Luke", ["lk", "luk"]],
  ["John", "John", ["jn", "jhn", "joh"]], ["Acts", "Acts", ["ac", "act"]], ["Rom", "Romans", ["ro", "rm"]],
  ["1Cor", "1 Corinthians", ["1co"]], ["2Cor", "2 Corinthians", ["2co"]], ["Gal", "Galatians", ["ga"]],
  ["Eph", "Ephesians", ["ephes"]], ["Phil", "Philippians", ["php", "pp"]], ["Col", "Colossians", ["co"]],
  ["1Thess", "1 Thessalonians", ["1th", "1thes"]], ["2Thess", "2 Thessalonians", ["2th", "2thes"]],
  ["1Tim", "1 Timothy", ["1ti"]], ["2Tim", "2 Timothy", ["2ti"]], ["Titus", "Titus", ["tit"]],
  ["Phlm", "Philemon", ["phm", "philem"]], ["Heb", "Hebrews", []], ["Jas", "James", ["jm", "jam"]],
  ["1Pet", "1 Peter", ["1pe", "1pt", "1p"]], ["2Pet", "2 Peter", ["2pe", "2pt", "2p"]],
  ["1John", "1 John", ["1jn", "1jo"]], ["2John", "2 John", ["2jn", "2jo"]], ["3John", "3 John", ["3jn", "3jo"]],
  ["Jude", "Jude", ["jud"]], ["Rev", "Revelation", ["re", "rv", "revelations", "apocalypse"]],
];

/** Lower case without spaces or dots, with a leading roman numeral as a digit ("II Kings" is "2kings"). */
const normalize = (s: string) =>
  s.trim().toLowerCase().replace(/^(i{1,3})\s+/, (_, r: string) => String(r.length)).replace(/[\s.]/g, "");
const NAME = new Map(BOOKS.map(([id, name]) => [id, name]));
const BY_SPELLING = new Map<string, string>();
for (const [id, name, others] of BOOKS) for (const s of [id, name, ...others]) BY_SPELLING.set(normalize(s), id);

/** The OSIS id for a book as written ("Exodus", "exod", "1 Kings", "Psalm"), if it's one. */
export function bookId(name: string): string | undefined {
  return BY_SPELLING.get(normalize(name));
}

/** Every book, in canonical order: for suggestions as someone types. */
export const BOOK_LIST = BOOKS.map(([id, name]) => ({ id, name }));

/**
 * Reads a passage as people write it: "Exodus", "Exodus 12", "exod 12-14", "Gen 12:1-9",
 * "Exodus 12:1–14:31", or the OSIS way, "Exod.12.1-14.31" (also "Exod.12.1-Exod.14.31").
 */
export function parsePassage(text: string): Passage | undefined {
  const book = String.raw`[1-3]?\s*[a-z][a-z\s]*?`;
  const m = new RegExp(
    String.raw`^\s*(${book})(?:[\s.]*(\d+)(?:[:.](\d+))?(?:\s*[-–]\s*(?:${book}[\s.]*)?(\d+)(?:[:.](\d+))?)?)?\s*$`, "i",
  ).exec(text);
  const id = m && bookId(m[1]);
  if (!id) return undefined;
  const [chapter, verse, end1, end2] = [m[2], m[3], m[4], m[5]].map((n) => (n === undefined ? undefined : Number(n)));
  if (chapter === undefined) return { book: id };
  if ([chapter, verse, end1, end2].some((n) => n === 0)) return undefined;
  const p: Passage = { book: id, chapter, ...(verse !== undefined && { verse }) };
  // After a dash: with a second number, chapter and verse; alone, a verse if the start had one, else a chapter.
  if (end2 !== undefined) Object.assign(p, { endChapter: end1, endVerse: end2 });
  else if (end1 !== undefined) Object.assign(p, verse !== undefined ? { endVerse: end1 } : { endChapter: end1 });
  return p;
}

/** The OSIS form for links: "Exod.12-14", "Gen.12.1-9", "Exod.12.1-14.31". */
export function formatPassageParam(p: Passage): string {
  let out = p.book;
  if (p.chapter === undefined) return out;
  out += `.${p.chapter}`;
  if (p.verse !== undefined) out += `.${p.verse}`;
  if (p.endChapter !== undefined && p.endChapter !== p.chapter) {
    out += `-${p.endChapter}`;
    if (p.endVerse !== undefined) out += `.${p.endVerse}`;
  } else if (p.endVerse !== undefined) out += `-${p.endVerse}`;
  return out;
}

/** "Exodus", "Exodus 12–14", "Genesis 12:1–9", "Psalm 23" (one psalm), "Psalms 1–41". */
export function formatPassage(p: Passage): string {
  const name = NAME.get(p.book) ?? p.book;
  if (p.chapter === undefined) return name;
  const several = p.endChapter !== undefined && p.endChapter !== p.chapter;
  let out = `${p.book === "Ps" && !several ? "Psalm" : name} ${p.chapter}`;
  if (p.verse !== undefined) out += `:${p.verse}`;
  if (several) {
    out += `–${p.endChapter}`;
    if (p.endVerse !== undefined) out += `:${p.endVerse}`;
  } else if (p.endVerse !== undefined) out += `–${p.endVerse}`;
  return out;
}

/** Start and end as chapter × 1000 + verse; a missing end verse runs to the end of its chapter. */
function span(r: { chapter?: number; verse?: number; endChapter?: number; endVerse?: number }): [number, number] {
  if (r.chapter === undefined) return [0, Infinity];
  const start = r.chapter * 1000 + (r.verse ?? 0);
  const endChapter = r.endChapter ?? r.chapter;
  // "Genesis 12:6" is one verse; "Genesis 12" and "Genesis 12–14" are whole chapters.
  const endVerse = r.endVerse ?? (r.verse !== undefined && r.endChapter === undefined ? r.verse : 999);
  return [start, endChapter * 1000 + endVerse];
}

/** Whether a Scripture reference shares any verse with a passage. */
export function overlaps(ref: ScriptureRef, p: Passage): boolean {
  if (bookId(ref.book) !== p.book) return false;
  const [a0, a1] = span(ref);
  const [b0, b1] = span(p);
  return a0 <= b1 && b0 <= a1;
}
