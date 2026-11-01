import { describe, expect, test } from "vitest";
import { DEFAULT_CHRONOLOGY } from "../src/data/chronologies";
import { eventsById } from "../src/data";
import { activeEvents, distanceFrom, NEAREST_COUNT } from "../src/lib/activeEvents";
import { adjacentEvent, eventsInOrder } from "../src/lib/entities";
import { drawnAsLifeMark, eventShown, filteredPeople, shownBy } from "../src/lib/filters";
import { parsePassage } from "../src/lib/passages";
import { data } from "../src/data";

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

describe("filters", () => {
  const chron = DEFAULT_CHRONOLOGY;
  const battles = shownBy({ types: ["battle"], people: [], passages: [] })!;

  test("Nearest events and stepping show only what the filters let through", () => {
    for (const year of [-1445, -1000, 30]) {
      expect(activeEvents(year, chron, undefined, battles).every((ev) => ev.type === "battle")).toBe(true);
    }
    expect(adjacentEvent(1, chron, -1445, "amalek", battles)?.id).toBe("conquest");
  });

  test("the selected event stays, even when filtered out", () => {
    const exodus = eventsById.get("exodus")!;
    const events = activeEvents(-1444.7, chron, exodus, battles);
    expect(events).toContain(exodus);
    expect(events.filter((ev) => ev !== exodus).every((ev) => ev.type === "battle")).toBe(true);
    expect(adjacentEvent(1, chron, -1444.7, "exodus", battles)?.type).toBe("battle");
  });

  test("events and people combine: any of the types, involving any of the people", () => {
    const f = { types: ["battle" as const], people: ["david"], passages: [] };
    const shown = eventsInOrder(chron).filter((ev) => eventShown(ev, f));
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((ev) => ev.type === "battle" && ev.people.includes("david"))).toBe(true);
  });

  test("people stand out: those filtered to, else everyone in a shown event", () => {
    expect(filteredPeople(data.events, { types: [], people: [], passages: [] })).toBeUndefined();
    expect([...filteredPeople(data.events, { types: ["battle"], people: ["david"], passages: [] })!]).toEqual(["david"]);
    const judged = filteredPeople(data.events, { types: ["judgment"], people: [], passages: [] })!;
    expect(judged.has("noah")).toBe(true);
    expect(judged.has("ruth")).toBe(false);
  });

  test("births and deaths filtered to are dots, not marks on a bar", () => {
    const birth = data.events.find((ev) => ev.type === "birth" && !ev.major)!;
    expect(drawnAsLifeMark(birth, { types: [], people: [], passages: [] })).toBe(true);
    expect(drawnAsLifeMark(birth, { types: ["birth"], people: [], passages: [] })).toBe(false);
  });
});

describe("passage filters", () => {
  test("show the events told in a passage", () => {
    const f = { types: [], people: [], passages: [parsePassage("Exodus 12-14")!] };
    const ids = eventsInOrder(DEFAULT_CHRONOLOGY).filter((ev) => eventShown(ev, f)).map((ev) => ev.id);
    expect(ids).toContain("exodus");
    expect(ids).not.toContain("burning-bush");
  });
});
