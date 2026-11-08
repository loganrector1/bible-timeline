import { describe, expect, test } from "vitest";
import { data, datesFor, empiresById, erasById, eventsById, locationsById, peopleById } from "../src/data";
import cliopatria from "../src/data/borders/cliopatria.json";
import drawn from "../src/data/borders/drawn.json";
import { BorderCollection } from "../src/data/schema";
import { borderContains, borderPower, bordersAt, borderYears, rulersOver } from "../src/lib/borders";
import { DEFAULT_CHRONOLOGY } from "../src/data/chronologies";
import { findProblems } from "../src/data/validate";
import { specBounds, specMidpoint } from "../src/lib/dates";
import { eventOrderKey, eventsForEmpire, personSpan, rulersOf, shownLane, shownLanes } from "../src/lib/entities";
import { familyOf, hasFamily, lineOf } from "../src/lib/family";
import { layoutFamily, treeTime } from "../src/lib/familyLayout";

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

describe("event types", () => {
  test("second types don't repeat each other or the main type", () => {
    for (const ev of data.events) {
      expect(new Set([ev.type, ...ev.alsoTypes]).size, ev.id).toBe(ev.alsoTypes.length + 1);
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
    expect(span("goliath")).toBeUndefined();
  });

  test("use dates when there are some", () => {
    expect(span("moses")?.derived).toBe(false);
  });

  test("are left out only for people without dates", () => {
    expect(data.people.filter((p) => p.noBar && p.dates).map((p) => p.id)).toEqual([]);
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

describe("the family tree", () => {
  test("runs from Adam to Jesus through both Gospels' lines", () => {
    const line = lineOf("jesus");
    for (const id of ["adam", "noah", "abraham", "judah", "boaz", "david", "solomon", "josiah", "nathan-son-of-david", "matt-jacob", "luke-heli-23"]) {
      expect(line, id).toContain(id);
    }
  });

  test("no one is their own ancestor", () => {
    for (const e of [...data.people, ...data.genealogy]) {
      const above = [...e.parents, ...e.altParents].flatMap((p) => [...lineOf(p)]);
      expect(above, e.id).not.toContain(e.id);
    }
  });

  test("follows the timeline: later rows are later years, and a dated person's row is their start", () => {
    const layout = layoutFamily("jesus");
    const time = treeTime(layout, DEFAULT_CHRONOLOGY)!;
    const rows = [...new Set([...layout.cards.values()].map((c) => c.y))].sort((a, b) => a - b);
    const years = rows.map(time.yearAt);
    expect(years.every((y, i) => i === 0 || y > years[i - 1])).toBe(true);
    const david = layout.cards.get("david")!;
    expect(time.yearAt(david.y)).toBeCloseTo(specBounds(datesFor(peopleById.get("david")!, DEFAULT_CHRONOLOGY)!)[0]);
    expect(time.yAt(time.yearAt(1234))).toBeCloseTo(1234);
  });

  test("every name from the genealogies belongs to a family", () => {
    for (const n of data.genealogy) expect(hasFamily(n.id), n.id).toBe(true);
    expect(familyOf("adam")).toContain("jesus");
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

describe("borders on the map", () => {
  const borders = [
    ...BorderCollection.parse(cliopatria).features,
    ...BorderCollection.parse(drawn).features,
  ];
  const known = { empire: empiresById, person: peopleById, era: erasById, event: eventsById, location: locationsById };

  test("ids are unique and links resolve", () => {
    const ids = borders.map((f) => f.properties.id);
    expect(ids.length).toBe(new Set(ids).size);
    for (const { properties: p } of borders) {
      if (p.empire) expect(empiresById.has(p.empire), `${p.id}: empire ${p.empire}`).toBe(true);
      for (const l of p.links ?? []) expect(known[l.kind].has(l.id), `${p.id}: ${l.kind} ${l.id}`).toBe(true);
    }
  });

  test("each shows for a while, within its empire's dates", () => {
    for (const f of borders) {
      for (const chron of ["early", "late"]) {
        const [from, to] = borderYears(f, chron);
        expect(from, `${f.properties.id} (${chron})`).toBeLessThan(to);
      }
      const empire = f.properties.empire && empiresById.get(f.properties.empire);
      if (!empire) continue;
      const [lo, hi] = specBounds(datesFor(empire, DEFAULT_CHRONOLOGY)!);
      expect(f.properties.from, f.properties.id).toBeGreaterThanOrEqual(lo);
      expect(f.properties.to, f.properties.id).toBeLessThanOrEqual(hi);
    }
  });

  // A power shows one outline at a time; its snapshots share the id before the @.
  test("a power's snapshots follow one another without overlapping", () => {
    const byPower = new Map<string, typeof borders>();
    for (const f of borders) byPower.set(borderPower(f), [...(byPower.get(borderPower(f)) ?? []), f]);
    for (const [power, outlines] of byPower) {
      const spans = outlines.map((f) => [f.properties.from, f.properties.to]).sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < spans.length; i++) expect(spans[i][0], power).toBeGreaterThanOrEqual(spans[i - 1][1]);
    }
  });

  test("labels sit inside their outlines", () => {
    for (const f of borders) expect(borderContains(f, f.properties.label), f.properties.id).toBe(true);
  });

  test("a place lists the powers that held it, in order", () => {
    const jerusalem = data.locations.find((l) => l.id === "jerusalem")!;
    const rulers = rulersOver(borders, jerusalem.coords, "early");
    const names = rulers.map((r) => r.name);
    expect(names.filter((n) => n.startsWith("Egypt"))).toEqual([]); // overlord, not ruler
    expect(names).toContain("Benjamin's allotment");
    expect(names.filter((n) => n === "Israel")).toHaveLength(1); // Saul's and David's, one stretch
    expect(rulers.find((r) => r.name === "Israel")?.target).toEqual({ kind: "era", id: "united-kingdom" });
    expect(names.indexOf("Judah")).toBeLessThan(names.indexOf("The Babylonian Empire"));
    expect(names.indexOf("The Babylonian Empire")).toBeLessThan(names.indexOf("The Persian Empire"));
    expect(rulers.find((r) => r.name === "The Roman Empire")?.open).toBe(true);
  });

  test("the map's story beats are there", () => {
    const at = (year: number, chron = "early") => bordersAt(borders, year, chron).map((f) => f.properties.name);
    expect(at(-720)).toContain("Assyria");
    expect(at(-720)).not.toContain("Israel"); // Samaria has fallen
    expect(at(-650)).toContain("Judah");
    expect(at(-500)).toEqual(expect.arrayContaining(["Persia", "Yehud"]));
    expect(at(-1300)).toContain("Judah"); // the tribes, early date
    expect(at(-1300, "late")).not.toContain("Judah"); // Israel is still in Egypt
  });
});
