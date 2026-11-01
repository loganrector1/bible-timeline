import { describe, expect, test } from "vitest";
import { data, datesFor, eventsById, peopleById } from "../src/data";
import { DEFAULT_CHRONOLOGY } from "../src/data/chronologies";
import { findProblems } from "../src/data/validate";
import { specBounds, specMidpoint } from "../src/lib/dates";
import { eventOrderKey, eventsForEmpire, personSpan, rulersOf, shownLane, shownLanes } from "../src/lib/entities";

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

describe("eras", () => {
  // An event belongs to the era holding its midpoint, so overlapping eras would claim the same events.
  test("follow one another without overlapping", () => {
    const chrons = new Set(data.eras.flatMap((e) => Object.keys(e.dates)));
    for (const chron of chrons) {
      const spans = data.eras.map((e) => ({ id: e.id, b: specBounds(datesFor(e, chron)!) }));
      for (let i = 1; i < spans.length; i++) {
        const [prev, next] = [spans[i - 1], spans[i]];
        expect(next.b[0], `${prev.id} → ${next.id} (${chron})`).toBeGreaterThanOrEqual(prev.b[1] - 1e-9);
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

describe("births and deaths", () => {
  // The event's dot (or its mark on the people lane) must sit at the end of the person's bar.
  test("match the lifespan of the person they're about", () => {
    for (const ev of data.events.filter((e) => e.type === "birth" || e.type === "death")) {
      const person = data.people.find((p) => p.id === ev.people[0]);
      if (!person?.dates) continue;
      for (const chron of new Set([DEFAULT_CHRONOLOGY, ...Object.keys(ev.dates), ...Object.keys(person.dates)])) {
        const life = datesFor(person, chron)!;
        const { year, month, day } = (ev.type === "birth" ? life.start : life.end) ?? {};
        const at = datesFor(ev, chron)!.start;
        expect({ year, month, day }, `${ev.id} and ${person.id} (${chron})`).toEqual({ year: at.year, month: at.month, day: at.day });
      }
    }
  });
});

describe("people's bars", () => {
  const span = (id: string) => personSpan(data.people.find((p) => p.id === id)!, DEFAULT_CHRONOLOGY);

  test("without dates, span the person's events", () => {
    expect(span("peter")?.derived).toBe(true);
    expect(span("jeremiah")?.derived).toBe(true); // A prophet, from his one ministry event.
  });

  test("need two or more events unless they're a prophet", () => {
    expect(span("hagar")).toBeUndefined();
  });

  test("use dates when there are some", () => {
    expect(span("moses")?.derived).toBe(false);
  });

  test("someone in two lanes shows in the first that's on", () => {
    const peter = data.people.find((p) => p.id === "peter")!;
    expect(shownLane(peter, ["people", "church"])).toBe("people");
    expect(shownLane(peter, ["church"])).toBe("church");
    expect(shownLane(peter, ["kings"])).toBeUndefined();
  });

  test("kings show in the Kings lane too, as their reign", () => {
    const david = data.people.find((p) => p.id === "david")!;
    expect(shownLanes(david, ["people", "kings"])).toEqual(["people", "kings"]);
    expect(shownLanes(david, ["kings"])).toEqual(["kings"]);
  });

  test("each kingdom's reigns follow on without overlapping, as their one column needs", () => {
    for (const kingdom of ["judah", "israel"]) {
      const reigns = data.people
        .filter((p) => p.kingdom === kingdom || (kingdom === "judah" && p.kingdom === "united"))
        .flatMap((p) => personSpan(p, DEFAULT_CHRONOLOGY, true) ?? [])
        .map((s) => s.bounds)
        .sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < reigns.length; i++) expect(reigns[i][0]).toBeGreaterThanOrEqual(reigns[i - 1][1]);
    }
  });
});

describe("tours", () => {
  test("step through events in date order, in both chronologies", () => {
    for (const chron of ["early", "late"]) {
      for (const tour of data.tours) {
        const keys = tour.steps.map((s) => eventOrderKey(eventsById.get(s.event)!, chron));
        expect(keys, tour.id).toEqual([...keys].sort((a, b) => a - b));
      }
    }
  });
});

describe("empires and rulers", () => {
  test("the Kings lane is Israel's and Judah's; other rulers are world history", () => {
    for (const p of data.people.filter((p) => p.lane === "kings")) expect(p.kingdom, p.id).toBeDefined();
    expect(peopleById.get("sennacherib")!.lane).toBe("world");
  });

  test("an empire's story: its rulers' events and world events at its capitals", () => {
    const ids = eventsForEmpire("assyria", DEFAULT_CHRONOLOGY).map((e) => e.id);
    expect(ids).toContain("sennacherib-siege");
    expect(ids).toContain("nineveh-falls");
    expect(rulersOf("persia", DEFAULT_CHRONOLOGY).map((p) => p.id).slice(0, 2)).toEqual(["cyrus", "darius"]);
  });

  test("world events say they're outside Scripture", () => {
    for (const ev of data.events.filter((e) => e.world)) expect(ev.dateNote, ev.id).toBeDefined();
  });
});
