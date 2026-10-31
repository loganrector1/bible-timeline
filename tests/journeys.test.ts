import { describe, expect, test } from "vitest";
import { eventsById, journeysById } from "../src/data";
import { drawnLegs, journeyLegs, stopIndexOf, type Leg } from "../src/lib/journeys";

// A short first leg, then a long one that bends around a via point: lengths 1 and 3 + 4 = 7.
const legs: Leg[] = [
  { path: [[0, 0], [1, 0]], offset: 0 },
  { path: [[1, 0], [4, 0], [4, 4]], offset: 0 },
];

describe("drawnLegs", () => {
  test("draws by length, through via points", () => {
    const { legs: drawn, head } = drawnLegs(legs, 5 / 8);
    expect(drawn).toHaveLength(2);
    expect(drawn[1].path).toEqual([[1, 0], [4, 0], [4, 1]]);
    expect(head).toEqual([4, 1]);
  });

  test("counts a stop as reached only when the line gets there", () => {
    expect(drawnLegs(legs, 0).reached).toBe(1);
    expect(drawnLegs(legs, 0.5 / 8).reached).toBe(1);
    expect(drawnLegs(legs, 2 / 8).reached).toBe(2);
    expect(drawnLegs(legs, 7.9 / 8).reached).toBe(2);
    expect(drawnLegs(legs, 1).reached).toBe(3);
  });

  test("draws nothing at the start", () => {
    expect(drawnLegs(legs, 0).legs).toEqual([]);
  });
});

describe("retraced stretches", () => {
  test("legs sharing part of the way are drawn side by side", () => {
    // To Egypt by the coast road, then back up it to Nazareth: different stops, same road.
    expect(journeyLegs("flight-to-egypt").map((l) => l.offset > 0)).toEqual([true, true]);
  });

  test("an out-and-back between the same places is too", () => {
    const offsets = journeyLegs("abram-to-canaan").map((l) => l.offset > 0);
    expect(offsets).toEqual([false, false, false, true, true, false]); // Bethel → Egypt → Bethel
  });
});

describe("events along a journey", () => {
  test("mark the stop at their first place, where a letter was written", () => {
    const stops = journeysById.get("paul-second-journey")!.stops;
    expect(stops[stopIndexOf("paul-second-journey", eventsById.get("thessalonians")!)].locationId).toBe("corinth");
  });

  test("take the next stop at their place, in date order, when the route passes it twice", () => {
    // Troas is stop 3 on the way out and 7 on the way back; Eutychus is after Romans at Corinth.
    expect(stopIndexOf("paul-third-journey", eventsById.get("eutychus")!) + 1).toBe(7);
  });
});
