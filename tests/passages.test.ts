import { describe, expect, test } from "vitest";
import { data } from "../src/data";
import { bookId, formatPassage, formatPassageParam, overlaps, parsePassage } from "../src/lib/passages";

describe("books", () => {
  test("every book in the data is recognized", () => {
    const books = new Set([...data.events, ...data.people].flatMap((e) => e.scripture.map((r) => r.book)));
    for (const b of books) expect(bookId(b), b).toBeDefined();
  });

  test("names, abbreviations and numerals", () => {
    expect(bookId("Exodus")).toBe("Exod");
    expect(bookId("exod")).toBe("Exod");
    expect(bookId("1 Kings")).toBe("1Kgs");
    expect(bookId("II Kings")).toBe("2Kgs");
    expect(bookId("Isaiah")).toBe("Isa");
    expect(bookId("Psalm")).toBe("Ps");
    expect(bookId("Song of Solomon")).toBe("Song");
    expect(bookId("Hezekiah")).toBeUndefined();
  });
});

describe("parsing passages", () => {
  test("as people write them", () => {
    expect(parsePassage("Exodus")).toEqual({ book: "Exod" });
    expect(parsePassage("Exodus 12")).toEqual({ book: "Exod", chapter: 12 });
    expect(parsePassage("exod 12-14")).toEqual({ book: "Exod", chapter: 12, endChapter: 14 });
    expect(parsePassage("Gen 12:1-9")).toEqual({ book: "Gen", chapter: 12, verse: 1, endVerse: 9 });
    expect(parsePassage("Exodus 12:1–14:31")).toEqual({ book: "Exod", chapter: 12, verse: 1, endChapter: 14, endVerse: 31 });
    expect(parsePassage("1 John 4:8")).toEqual({ book: "1John", chapter: 4, verse: 8 });
    expect(parsePassage("Song of Songs 2")).toEqual({ book: "Song", chapter: 2 });
  });

  test("the OSIS way, and round trips", () => {
    expect(parsePassage("Exod.12.1-Exod.14.31")).toEqual({ book: "Exod", chapter: 12, verse: 1, endChapter: 14, endVerse: 31 });
    for (const s of ["Exod", "Exod.12-14", "Gen.12.1-9", "Exod.12.1-14.31", "Ps.23", "1Kgs.18"]) {
      expect(formatPassageParam(parsePassage(s)!)).toBe(s);
    }
  });

  test("rejects what isn't a passage", () => {
    for (const s of ["", "Hezekiah 3", "Exodus 0", "Exodus 12:", "12-14", "Exodus-14"]) expect(parsePassage(s), s).toBeUndefined();
  });

  test("display", () => {
    expect(formatPassage({ book: "Exod", chapter: 12, endChapter: 14 })).toBe("Exodus 12–14");
    expect(formatPassage({ book: "Ps", chapter: 23 })).toBe("Psalm 23");
    expect(formatPassage({ book: "Ps", chapter: 1, endChapter: 41 })).toBe("Psalms 1–41");
    expect(formatPassage({ book: "Ps" })).toBe("Psalms");
  });
});

describe("overlap", () => {
  const ex = (s: string) => parsePassage(s)!;
  const ref = { book: "Exodus", chapter: 12, verse: 1, endChapter: 14, endVerse: 31 };

  test("shares a verse", () => {
    expect(overlaps(ref, ex("Exodus"))).toBe(true);
    expect(overlaps(ref, ex("Exodus 14"))).toBe(true);
    expect(overlaps(ref, ex("Exodus 14:31"))).toBe(true);
    expect(overlaps(ref, ex("Exodus 15"))).toBe(false);
    expect(overlaps(ref, ex("Exodus 11:10"))).toBe(false);
    expect(overlaps(ref, ex("Genesis 12"))).toBe(false);
  });

  test("single verses and chapter ranges ending mid-chapter", () => {
    expect(overlaps({ book: "Isaiah", chapter: 1, verse: 1 }, ex("Isaiah 1:2"))).toBe(false);
    expect(overlaps({ book: "Genesis", chapter: 1, endChapter: 2, endVerse: 3 }, ex("Genesis 2:4"))).toBe(false);
    expect(overlaps({ book: "Genesis", chapter: 1, endChapter: 2, endVerse: 3 }, ex("Genesis 2:1"))).toBe(true);
    expect(overlaps({ book: "Psalm", chapter: 23 }, ex("Psalms 20-25"))).toBe(true);
  });
});
