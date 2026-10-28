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
