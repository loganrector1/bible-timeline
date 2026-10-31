import { describe, expect, test } from "vitest";
import { DEFAULT_CHRONOLOGY } from "../src/data/chronologies";
import { eventsById } from "../src/data";
import { activeEvents, distanceFrom, NEAREST_COUNT } from "../src/lib/activeEvents";
import { eventsInOrder } from "../src/lib/entities";

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
  const nearest = (year: number) => activeEvents(year, DEFAULT_CHRONOLOGY)[0].id;

  test("a specific event beats a long span that covers the cursor", () => {
    expect(nearest(-1484.5)).toBe("moses-flees"); // 1486 BC, during the oppression
  });

  test("a long span still wins when nothing specific is near", () => {
    expect(nearest(-1425)).toBe("wandering");
  });
});

describe("selected event", () => {
  const ids = (year: number, id: string) =>
    activeEvents(year, DEFAULT_CHRONOLOGY, eventsById.get(id)).map((ev) => ev.id);

  test("is always listed, with the events just before and after it", () => {
    // Forty years in the wilderness, viewed at its start, where shorter events crowd in.
    const list = ids(-1444, "wandering");
    expect(list).toHaveLength(NEAREST_COUNT);
    expect(list).toContain("wandering");
    const order = eventsInOrder(DEFAULT_CHRONOLOGY).map((ev) => ev.id);
    const i = order.indexOf("wandering");
    expect(list).toContain(order[i - 1]);
    expect(list).toContain(order[i + 1]);
  });

  test("is listed with the event it's part of, wherever the cursor is", () => {
    // Just after selecting, the cursor is still where it was (the death of Moses).
    expect(ids(-1405, "sun-stands-still")).toContain("conquest");
  });

  test("at the ends of time, there's only one neighbour", () => {
    expect(ids(-4113, "creation")).toContain("creation");
    expect(ids(-4113, "creation")).toHaveLength(NEAREST_COUNT);
  });
});

describe("date order", () => {
  const order = eventsInOrder(DEFAULT_CHRONOLOGY).map((ev) => ev.id);
  const before = (a: string, b: string) => expect(order.indexOf(a), `${a} before ${b}`).toBeLessThan(order.indexOf(b));

  test("a span sorts by its start, so a journey comes before what happens along it", () => {
    before("exodus", "red-sea");
    before("exodus", "amalek");
  });

  test("a moment known only to the month sorts mid-month", () => {
    before("manna", "amalek"); // 15th of the 2nd month, then Rephidim later that month
  });

  test("a span known only to the year starts mid-year, level with a moment that year", () => {
    before("burning-bush", "plagues"); // Both 1446 BC; the file's (Scripture's) order breaks the tie.
  });

  test("on a tie, the larger event comes before the events within it", () => {
    before("plagues", "passover");
  });
});

describe("events along a journey", () => {
  test("come after the journey, in order", () => {
    const order = eventsInOrder(DEFAULT_CHRONOLOGY).map((ev) => ev.id);
    const i = order.indexOf("exodus");
    expect(order.slice(i, i + 4)).toEqual(["exodus", "red-sea", "manna", "amalek"]);
  });
});
