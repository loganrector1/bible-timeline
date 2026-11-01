import type { ScriptureRef } from "../data/schema";

/** "Exodus 12", "Exodus 12:6", "Exodus 12:1–14:31", "Genesis 12:1–9". */
export function formatRef(ref: ScriptureRef): string {
  const { book, chapter, verse, endChapter, endVerse } = ref;
  let out = `${book} ${chapter}`;
  if (verse !== undefined) out += `:${verse}`;
  if (endChapter !== undefined && endChapter !== chapter) {
    out += `–${endChapter}`;
    if (endVerse !== undefined) out += `:${endVerse}`;
  } else if (endVerse !== undefined) {
    out += `–${endVerse}`;
  }
  return out;
}

// The app shows the Berean Standard Bible; the link out offers the ESV, which many readers'
// churches use (its licence doesn't allow bundling it).
const VERSION = "ESV";

export function refUrl(ref: ScriptureRef): string {
  const search = formatRef(ref).replace(/–/g, "-");
  return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(search)}&version=${VERSION}`;
}
