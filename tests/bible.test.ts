import { describe, expect, test } from "vitest";
import { data } from "../src/data";
import { loadBook, refBookId, versesOf } from "../src/lib/bible";
import { formatRef } from "../src/lib/scripture";

const refs = [...data.events, ...data.people, ...data.genealogy].flatMap((e) => e.scripture.map((r) => ({ owner: e.id, ref: r })));

describe("Bible text", () => {
  test("every reference in the data is a real passage in the BSB", async () => {
    for (const { owner, ref } of refs) {
      const what = `${owner}: ${formatRef(ref)}`;
      const book = await loadBook(refBookId(ref)!);
      const lastChapter = ref.endChapter ?? ref.chapter;
      expect(lastChapter, what).toBeLessThanOrEqual(book.length);
      expect(ref.verse ?? 1, what).toBeLessThanOrEqual(book[ref.chapter - 1].length);
      if (ref.endVerse !== undefined) expect(ref.endVerse, what).toBeLessThanOrEqual(book[lastChapter - 1].length);
      expect(versesOf(book, ref).length, what).toBeGreaterThan(0);
    }
  });

  test("a chapter, a verse, a verse range, and a range across chapters", async () => {
    const exod = await loadBook("Exod");
    const ref = (r: Partial<{ chapter: number; verse: number; endChapter: number; endVerse: number }>) =>
      versesOf(exod, { book: "Exodus", chapter: 12, ...r }).map((v) => `${v.chapter}:${v.verse}`);
    expect(ref({}).length).toBe(51);
    expect(ref({ verse: 6 })).toEqual(["12:6"]);
    expect(ref({ verse: 1, endVerse: 3 })).toEqual(["12:1", "12:2", "12:3"]);
    const across = ref({ verse: 50, endChapter: 13, endVerse: 2 });
    expect(across).toEqual(["12:50", "12:51", "13:1", "13:2"]);
    expect(ref({ endChapter: 14 }).at(-1)).toBe("14:31");
  });

  test("verses the BSB leaves out are skipped", async () => {
    const matt = await loadBook("Matt");
    const verses = versesOf(matt, { book: "Matthew", chapter: 17, verse: 20, endVerse: 22 }).map((v) => v.verse);
    expect(verses).toEqual([20, 22]);
  });

  test("Jesus' words are marked, and the plain text keeps every word", async () => {
    const matt = await loadBook("Matt");
    const [v] = versesOf(matt, { book: "Matthew", chapter: 4, verse: 19 });
    expect(v.text).toBe("“Come, follow Me,” Jesus said, “and I will make you fishers of men.”");
    expect(v.parts).toEqual([
      { text: "“Come, follow Me,”", jesus: true },
      { text: " Jesus said, ", jesus: false },
      { text: "“and I will make you fishers of men.”", jesus: true },
    ]);
    const exod = await loadBook("Exod");
    expect(versesOf(exod, { book: "Exodus", chapter: 3, verse: 14 })[0].parts.every((p) => !p.jesus)).toBe(true);
  });
});
