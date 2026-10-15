// Headless drivers: CAREFUL goes full throttle and pulls into every bay it can use, FAST never stops. They print what
// a run looks like in numbers (street length sizing, what a stop costs, how far a run goes) and, with GEN_VECTORS=1,
// write their decision logs into rules/vectors.json for the chain script to agree with.
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BAY, GROUP, RATE, RUN, W, candidate, newSim, step, type Input, type Sim } from "./sim";
import { LEGS, extend } from "./course";
import { replay } from "./rules";

function drive(s: Sim, careful: boolean): Input {
  const c = careful ? candidate(s) : undefined;
  const useful = c && (c.rider ? s.seats.includes(null) : s.seats.some((r) => r && r.dest === c.drop));
  const target = useful ? c!.z + c!.len - 6 : null; // aim at the far end of the bay
  const brakeDist = (s.v * s.v) / (2 * 28) + 8;
  const inBay = target !== null && s.z >= c!.z && s.z <= c!.z + c!.len;
  const overshot = target !== null && s.z > c!.z + c!.len;
  const stopping = target !== null && target - s.z < brakeDist && (inBay || overshot || s.v > 2); // short of the bay at rest: creep
  const laneX = stopping ? W + BAY - 1.2 : 0;
  // dodge what's in the lane ahead
  const ahead = [...s.traffic.map((c) => ({ z: c.z, x: c.x })), ...s.hazards.filter((h) => !h.hit)].find((o) => o.z > s.z && o.z < s.z + 80 && Math.abs(o.x - s.x) < 2.5);
  const want = ahead && !stopping ? (ahead.x > 0 ? ahead.x - 3.5 : ahead.x + 3.5) : laneX;
  return { gas: !stopping, brake: stopping && (s.v > 0 || overshot), left: want < s.x - 0.3, right: want > s.x + 0.3 };
}

function run(seed: number, careful: boolean) {
  const s = newSim(seed);
  while (!s.over) step(s, drive(s, careful), 1 / 120, extend);
  const n = (k: string) => s.log.filter((e) => e.k === k).length;
  const line = `${careful ? "careful" : "fast"} seed ${seed}: ${Math.round(s.dist)} m, leg ${s.streets.length}, ${n("pick")} picks, ${n("drop")} drops, ${n("wreck")} wrecks, score ${s.score} (banked ${s.banked})`;
  return { s, line };
}

describe("bot runs", () => {
  it("careful and fast play both score, the careful run ends around leg 5, and the rules replay every log", () => {
    const runs = [7, 8].flatMap((seed) => [run(seed, true), run(seed, false)]);
    const report = runs.map((r) => r.line).join("\n") + "\n\n" + runs[0].s.log.map((e) => JSON.stringify(e)).join("\n") + "\n";
    writeFileSync("bot-run.txt", report); // vitest hides stdout on passing tests
    for (const { s } of runs) {
      expect(s.t).toBe(RUN);
      expect(replay(s.course, s.log, s.dist).score).toBe(s.score);
    }
    const [careful, fast] = runs;
    expect(careful.s.banked).toBeGreaterThan(0);
    expect(fast.s.score).toBeGreaterThan(0);
    expect(careful.s.streets.length).toBeGreaterThanOrEqual(5);
    expect(careful.s.streets.length).toBeLessThanOrEqual(6);
    if (process.env.GEN_VECTORS) {
      const vectors = {
        version: 1, run_seconds: RUN, rate: RATE, group: GROUP, legs: LEGS,
        age_points: [[18, 0], [20, 0], [50, 600], [60, 800], [65, 900], [69, 980], [70, 1000], [80, 1000], [81, 950], [90, 500], [99, 50], [100, 0]],
        runs: runs.map(({ s }) => ({ seed: s.seed, dist: Math.round(s.dist), banked: s.banked, score: s.score, log: s.log })),
      };
      const text = JSON.stringify(vectors, null, 1)
        .replace(/\[\s+((?:-?[\d.]+,\s+)*-?[\d.]+)\s+\]/g, (_, xs: string) => `[${xs.replace(/\s+/g, " ")}]`)
        .replace(/\{\s+"k"[^}]*\}/g, (m) => m.replace(/\s+/g, " "));
      writeFileSync("../rules/vectors.json", text + "\n");
    }
  });
});
