import { describe, expect, test } from "vitest";
import {
  formatDateSpec, formatTimePoint, formatYear, fromFractional, fromHistorical,
  pointBounds, precisionOf, specBounds, toHistorical,
} from "../src/lib/dates";

describe("year conversion", () => {
  test("BC years map to astronomical numbering", () => {
    expect(fromHistorical(1446, true)).toBe(-1445);
    expect(fromHistorical(1, true)).toBe(0);
    expect(fromHistorical(30, false)).toBe(30);
    expect(toHistorical(-1445)).toEqual({ n: 1446, bc: true });
  });

  test("1 BC is followed directly by AD 1, with no year 0", () => {
    expect(formatYear(0)).toBe("1 BC");
    expect(formatYear(0 + 1)).toBe("AD 1");
  });

  test("era styles", () => {
    expect(formatYear(-1445)).toBe("1446 BC");
    expect(formatYear(-1445, "BCE")).toBe("1446 BCE");
    expect(formatYear(30)).toBe("AD 30");
    expect(formatYear(30, "BCE")).toBe("30 CE");
  });
});

describe("fractional years", () => {
  test("a bare year covers the whole year", () => {
    expect(pointBounds({ year: -1445 })).toEqual([-1445, -1444]);
  });

  test("month and day points sit inside their year, in order", () => {
    const passover = pointBounds({ year: -1445, month: 4, day: 14 })[0];
    const sinai = pointBounds({ year: -1445, month: 6 })[0];
    const tabernacle = pointBounds({ year: -1444, month: 3, day: 1 })[0];
    expect(passover).toBeGreaterThan(-1445);
    expect(passover).toBeLessThan(sinai);
    expect(sinai).toBeLessThan(-1444);
    expect(tabernacle).toBeGreaterThan(-1444);
  });

  test("a span runs from the start of its first point to the end of its last", () => {
    expect(specBounds({ start: { year: -1525 }, end: { year: -1405 }, confidence: "approx" }))
      .toEqual([-1525, -1404]);
  });

  test("fromFractional inverts pointBounds", () => {
    for (const tp of [{ year: -1445 }, { year: -1445, month: 4 }, { year: -1445, month: 4, day: 14 }, { year: 30, month: 12, day: 31 }]) {
      const [lo, hi] = pointBounds(tp);
      expect(fromFractional((lo + hi) / 2, precisionOf(tp))).toEqual(tp);
    }
  });

  test("precision comes from which fields are set", () => {
    expect(precisionOf({ year: 1 })).toBe("year");
    expect(precisionOf({ year: 1, month: 3 })).toBe("month");
    expect(precisionOf({ year: 1, month: 3, day: 9 })).toBe("day");
  });
});

describe("formatting", () => {
  test("points at each precision", () => {
    expect(formatTimePoint({ year: -1445 })).toBe("1446 BC");
    expect(formatTimePoint({ year: -1445, month: 4 })).toBe("Apr 1446 BC");
    expect(formatTimePoint({ year: -1445, month: 4, day: 14 })).toBe("14 Apr 1446 BC");
    expect(formatTimePoint({ year: -1445, month: 4, day: 14, label: "14 Nisan" }))
      .toBe("14 Nisan, 1446 BC");
  });

  test("approximate and unknown dates", () => {
    expect(formatDateSpec({ start: { year: -1445 }, confidence: "approx" })).toBe("c. 1446 BC");
    expect(formatDateSpec({ start: { year: -1445 }, confidence: "unknown" })).toBe("Date unknown");
  });

  test("year ranges", () => {
    expect(formatDateSpec({ start: { year: -1525 }, end: { year: -1405 }, confidence: "approx" }))
      .toBe("c. 1526–1406 BC");
    expect(formatDateSpec({ start: { year: 30 }, end: { year: 33 }, confidence: "range" }))
      .toBe("AD 30–33");
    expect(formatDateSpec({ start: { year: -3 }, end: { year: 30 }, confidence: "approx" }))
      .toBe("c. 4 BC – AD 30");
  });

  test("sub-year ranges within one year", () => {
    expect(formatDateSpec({
      start: { year: -1445, month: 4, label: "1st month" },
      end: { year: -1445, month: 6, label: "3rd month" },
      confidence: "exact",
    })).toBe("1st month – 3rd month, 1446 BC");
  });

  test("never shows a year 0", () => {
    for (let y = -5; y <= 5; y++) expect(formatYear(y)).not.toMatch(/\b0\b/);
  });
});
