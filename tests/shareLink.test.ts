import { describe, expect, test } from "vitest";
import { formatLink, formatYearParam, parseLink, parseYearParam } from "../src/lib/shareLink";

describe("year parameter", () => {
  test("is written as people write years, with the fraction of the year", () => {
    expect(formatYearParam(-1444.5, 1)).toBe("1446.5BC");
    expect(formatYearParam(-1445, 2)).toBe("1446BC");
    expect(formatYearParam(30.25, 2)).toBe("30.25AD");
    expect(formatYearParam(0.5, 1)).toBe("1.5BC");
  });

  test("rounding up carries into the next year", () => {
    expect(formatYearParam(-1444.03, 1)).toBe("1445BC");
    expect(formatYearParam(29.999, 2)).toBe("30AD");
  });

  test("reads what it writes, and the usual spellings", () => {
    for (const y of [-1445.5, -1445, 30.25, 0.5, 1, -3999.125]) expect(parseYearParam(formatYearParam(y, 3))).toBeCloseTo(y, 6);
    expect(parseYearParam("1446bc")).toBe(-1445);
    expect(parseYearParam("1446 BCE")).toBe(-1445);
    expect(parseYearParam("AD30")).toBe(30);
    expect(parseYearParam("30 ce")).toBe(30);
    expect(parseYearParam("-1444.5")).toBe(-1444.5);
  });

  test("rejects year 0 and nonsense", () => {
    expect(parseYearParam("0BC")).toBeUndefined();
    expect(parseYearParam("AD30BC")).toBeUndefined();
    expect(parseYearParam("soon")).toBeUndefined();
  });
});

describe("links", () => {
  test("round-trip the view, selection, year and zoom", () => {
    const query = formatLink({ mode: "map", selection: { kind: "location", id: "jerusalem" }, year: -1000.4, pxPerYear: 12.345 });
    expect(query).toBe("place=jerusalem&year=1002.6BC&zoom=12.3&view=map");
    expect(parseLink(`?${query}`)).toEqual({
      mode: "map", selection: { kind: "location", id: "jerusalem" }, year: expect.closeTo(-1000.4, 6), pxPerYear: 12.3,
    });
  });

  test("leave out the default view and an empty selection", () => {
    expect(formatLink({ mode: "split", selection: null, year: -1444.5, pxPerYear: 0.6 })).toBe("year=1446.5BC&zoom=0.6");
  });

  test("can leave out the year", () => {
    expect(formatLink({ mode: "split", selection: { kind: "event", id: "exodus" }, pxPerYear: 3 })).toBe("event=exodus&zoom=3");
  });

  test("carry filters", () => {
    const query = formatLink({
      mode: "split", selection: null, pxPerYear: 1, filters: { types: ["battle", "miracle"], people: ["david"], passages: [] },
    });
    expect(query).toBe("zoom=1&types=battle,miracle&people=david");
    expect(parseLink(`?${query}`).filters).toEqual({ types: ["battle", "miracle"], people: ["david"], passages: [] });
    expect(parseLink("?types=battle,dancing&people=nobody").filters).toEqual({ types: ["battle"], people: [], passages: [] });
  });

  test("carry passages the OSIS way", () => {
    const filters = parseLink("?passage=Exod.12-14,Matt.5.1-7.29,Nowhere.3").filters!;
    expect(filters.passages).toEqual([
      { book: "Exod", chapter: 12, endChapter: 14 },
      { book: "Matt", chapter: 5, verse: 1, endChapter: 7, endVerse: 29 },
    ]);
    expect(formatLink({ mode: "split", selection: null, pxPerYear: 1, filters })).toBe("zoom=1&passage=Exod.12-14,Matt.5.1-7.29");
  });

  test("carry the chronology when it isn't the default", () => {
    expect(formatLink({ mode: "split", selection: null, pxPerYear: 1, chronology: "late" })).toBe("zoom=1&chron=late");
    expect(formatLink({ mode: "split", selection: null, pxPerYear: 1, chronology: "early" })).toBe("zoom=1");
    expect(parseLink("?chron=late").chronology).toBe("late");
    expect(parseLink("?chron=someday").chronology).toBeUndefined();
  });

  test("carry a tour and its step, counting from 1", () => {
    expect(formatLink({ mode: "split", selection: null, pxPerYear: 1, tour: { id: "exodus", step: 2 } })).toBe("zoom=1&tour=exodus&step=3");
    expect(parseLink("?tour=exodus&step=3").tour).toEqual({ id: "exodus", step: 2 });
    expect(parseLink("?tour=exodus").tour).toEqual({ id: "exodus", step: 0 });
    expect(parseLink("?tour=nowhere&step=2").tour).toBeUndefined();
  });

  test("ignore unknown ids, views and bad numbers", () => {
    expect(parseLink("?event=no-such-event&view=sideways&zoom=-3&year=soon")).toEqual({});
    expect(parseLink("?event=exodus&person=moses").selection).toEqual({ kind: "event", id: "exodus" });
  });
});
