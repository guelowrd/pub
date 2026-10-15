// rules/vectors.json pins the scoring rules and a few full runs; the chain script (M4) must agree with every case.
import { describe, expect, it } from "vitest";
import vectors from "../../../rules/vectors.json";
import { GROUP, RATE, RUN, agePoints, type Event } from "./sim";
import { LEGS, pyramid } from "./course";
import { replay } from "./rules";

describe("rules vectors", () => {
  it("constants and age points", () => {
    expect(vectors.run_seconds).toBe(RUN);
    expect(vectors.rate).toBe(RATE);
    expect(vectors.group).toEqual(GROUP);
    expect(vectors.legs).toBe(LEGS);
    for (const [age, pts] of vectors.age_points) expect(agePoints(age)).toBe(pts);
  });
  it("replays each logged run to its score", () => {
    expect(vectors.runs.length).toBeGreaterThan(0);
    for (const r of vectors.runs as { seed: number; dist: number; banked: number; score: number; log: Event[] }[]) expect(replay(pyramid(r.seed), r.log as Event[], r.dist)).toEqual({ banked: r.banked, score: r.score });
  });
  it("rejects broken logs", () => {
    const c = pyramid(1);
    const pick = (stop: number, t: number): Event => ({ k: "pick", stop, t });
    expect(() => replay(c, [pick(0, 1000), pick(0, 3000)], 2000)).toThrow("already taken");
    expect(() => replay(c, [pick(0, 1000), pick(1, 3000), pick(2, 5000), { k: "fork", side: -1, t: 7000 }, pick(0, 9000), pick(1, 11000)], 4000)).toThrow("car full");
    expect(() => replay(c, [{ k: "drop", t: 100 }], 0)).toThrow("first street");
    expect(() => replay(c, [pick(0, 200), pick(1, 100)], 0)).toThrow("backwards");
    expect(() => replay(c, [pick(0, 1000), pick(1, 1130)], 2000)).toThrow("faster than the car"); // 120 m or more in 0.1 s
    expect(() => replay(c, [{ k: "fork", side: 1, t: 3000 }], 100)).toThrow("distance does not fit");
    expect(() => replay(c, [pick(0, RUN * 100 + 1)], 0)).toThrow("time up");
    expect(() => replay(c, Array.from({ length: LEGS }, (_, i): Event => ({ k: "fork", side: 1, t: 2000 * i + 1000 })), 12000)).toThrow("last leg");
    // a wreck empties the car, so the next drop has nobody
    const r0 = c[0][0].stops[0].rider, side = c[1][0].district === r0.dest ? -1 : c[1][1].district === r0.dest ? 1 : 0;
    if (side) expect(() => replay(c, [pick(0, 1000), { k: "wreck", t: 2000 }, { k: "fork", side, t: 4000 }, { k: "drop", t: 5000 }], 4000)).toThrow("nobody");
  });
});
