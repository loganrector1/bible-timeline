import { describe, expect, test } from "vitest";
import { DEFAULT_CHRONOLOGY } from "../src/data/chronologies";
import { activeEvents, distanceFrom, NEAREST_COUNT } from "../src/lib/activeEvents";

describe("activeEvents", () => {
  test("returns a fixed number of events, nearest first", () => {
    for (const year of [-3000, -2090, -1445, -1405]) {
      const events = activeEvents(year, DEFAULT_CHRONOLOGY);
      expect(events).toHaveLength(NEAREST_COUNT);
      const d = events.map((ev) => distanceFrom(year, ev, DEFAULT_CHRONOLOGY));
      expect(d).toEqual([...d].sort((a, b) => a - b));
    }
  });
});

describe("nearest event", () => {
  const nearest = (year: number) => activeEvents(year, DEFAULT_CHRONOLOGY, 1)[0].id;

  test("a specific event beats a long span that covers the cursor", () => {
    expect(nearest(-1484.5)).toBe("moses-flees"); // 1486 BC, during the oppression
  });

  test("a long span still wins when nothing specific is near", () => {
    expect(nearest(-1425)).toBe("wandering");
  });
});
