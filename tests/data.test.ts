import { describe, expect, test } from "vitest";
import { data } from "../src/data";
import { findProblems } from "../src/data/validate";
import { specBounds } from "../src/lib/dates";

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
