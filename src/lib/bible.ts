import type { ScriptureRef } from "../data/schema";
import { bookId } from "./passages";

/** A book's text: chapters of verses, both counting from 0 ("" for a verse the BSB leaves out). */
export type BookText = string[][];
export type Verse = { chapter: number; verse: number; text: string };

// The Berean Standard Bible, one file per book (scripts/bsb.mjs), each its own chunk, so a reader
// downloads only the books they open.
const BOOKS = import.meta.glob<BookText>("../data/bible/*.json", { import: "default" });
const loaded = new Map<string, Promise<BookText>>();

/** The text of a book by OSIS id ("Exod"), fetched once. */
export function loadBook(id: string): Promise<BookText> {
  const load = BOOKS[`../data/bible/${id}.json`];
  if (!load) return Promise.reject(new Error(`No text for ${id}`));
  if (!loaded.has(id)) {
    const p = load();
    // A failed download (offline) may be tried again.
    p.catch(() => loaded.delete(id));
    loaded.set(id, p);
  }
  return loaded.get(id)!;
}

/** The OSIS id of a reference's book ("Exodus" is "Exod"). */
export const refBookId = (ref: ScriptureRef) => bookId(ref.book);

/**
 * The verses a reference covers: "Exodus 12" is the chapter, "Exodus 12:1–14:31" runs from
 * verse to verse, "Exodus 12–14" is whole chapters. Verses the BSB leaves out are skipped.
 */
export function versesOf(book: BookText, ref: ScriptureRef): Verse[] {
  const endChapter = ref.endChapter ?? ref.chapter;
  const out: Verse[] = [];
  for (let c = ref.chapter; c <= endChapter && c <= book.length; c++) {
    const verses = book[c - 1];
    const from = c === ref.chapter ? (ref.verse ?? 1) : 1;
    // A single verse ("12:6") ends where it starts; otherwise at endVerse, or the chapter's end.
    const to =
      c === endChapter && ref.endVerse !== undefined ? ref.endVerse
      : c === endChapter && ref.verse !== undefined && ref.endChapter === undefined ? ref.verse
      : verses.length;
    for (let v = from; v <= Math.min(to, verses.length); v++) {
      if (verses[v - 1]) out.push({ chapter: c, verse: v, text: verses[v - 1] });
    }
  }
  return out;
}
