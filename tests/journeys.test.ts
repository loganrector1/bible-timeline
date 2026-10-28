import { describe, expect, test } from "vitest";
import { drawnLegs, type Leg } from "../src/lib/journeys";

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
