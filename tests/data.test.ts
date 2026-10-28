import { describe, expect, test } from "vitest";
import { data, datesFor } from "../src/data";
import { DEFAULT_CHRONOLOGY } from "../src/data/chronologies";
import { findProblems } from "../src/data/validate";
import { specBounds, specMidpoint } from "../src/lib/dates";

describe("seed data", () => {
  test("parses and every link resolves", () => {
    expect(findProblems(data)).toEqual([]);
  });

  test("every date range runs forward in time", () => {
    const dated = [...data.eras, ...data.events, ...data.people];
    for (const item of dated) {
      for (const [chron, spec] of Object.entries(item.dates ?? {})) {
        const [lo, hi] = specBounds(spec);
        expect(lo, `${item.id} (${chron})`).toBeLessThan(hi);
      }
    }
  });
});

describe("events that are part of another", () => {
  // Within, not strictly inside: "4th month" for the Red Sea overlaps an Exodus that starts on the 15th.
  test("fall within their parent's dates", () => {
    for (const ev of data.events.filter((e) => e.partOf)) {
      const parent = data.events.find((p) => p.id === ev.partOf)!;
      for (const chron of new Set([DEFAULT_CHRONOLOGY, ...Object.keys(ev.dates), ...Object.keys(parent.dates)])) {
        const mid = specMidpoint(datesFor(ev, chron)!);
        const [lo, hi] = specBounds(datesFor(parent, chron)!);
        expect(mid, `${ev.id} within ${parent.id} (${chron})`).toBeGreaterThanOrEqual(lo);
        expect(mid, `${ev.id} within ${parent.id} (${chron})`).toBeLessThanOrEqual(hi);
      }
    }
  });
});
