// A headless driver: full throttle, pulls into every bay it can use. Prints what a run looks like in numbers,
// so tuning questions (is the bay reachable at speed, what does a stop cost, how far does a run go) get answers
// before a human plays. Also the model the chain's feasibility check will share (M2).
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BAY, KMH, RUN, W, candidate, newSim, step, type Input, type Sim } from "./sim";
import { extend } from "./course";

function drive(s: Sim): Input {
  const c = candidate(s);
  const useful = c && (c.rider ? s.seats.includes(null) : s.seats.some((r) => r && r.dest === c.drop));
  const target = useful ? c!.z + c!.len - 6 : null; // aim at the far end of the bay
  const brakeDist = (s.v * s.v) / (2 * 28) + 8;
  const inBay = target !== null && s.z >= c!.z && s.z <= c!.z + c!.len;
  const stopping = target !== null && target - s.z < brakeDist && (inBay || s.v > 2); // short of the bay at rest: creep
  const laneX = stopping ? W + BAY - 1.2 : 0;
  // dodge what's in the lane ahead
  const ahead = [...s.traffic.map((c) => ({ z: c.z, x: c.x })), ...s.hazards.filter((h) => !h.hit)].find((o) => o.z > s.z && o.z < s.z + 80 && Math.abs(o.x - s.x) < 2.5);
  const want = ahead && !stopping ? (ahead.x > 0 ? ahead.x - 3.5 : ahead.x + 3.5) : laneX;
  return { gas: !stopping, brake: stopping, left: want < s.x - 0.3, right: want > s.x + 0.3 };
}

describe("bot run", () => {
  it("finishes a run with pickups and drops", () => {
    const s = newSim(7);
    let stops = 0;
    while (!s.over) {
      const before = s.boarding;
      step(s, drive(s), 1 / 120, extend);
      if (before <= 0 && s.boarding > 0) stops++;
    }
    const picks = s.log.filter((l) => l.startsWith("pick")).length, drops = s.log.filter((l) => l.startsWith("drop")).length;
    const report = `bot: ${Math.round(s.dist)} m, ${s.streets.length} streets, ${picks} picks, ${drops} drops, ${s.log.filter((l) => l.startsWith("wreck")).length} wrecks, score ${s.score} (banked ${s.banked}), ${Math.round(s.v * KMH)} km/h at the end, ${stops} stops\n${s.log.join("\n")}\n`;
    writeFileSync("bot-run.txt", report); // vitest hides stdout on passing tests
    expect(s.t).toBe(RUN);
    expect(picks).toBeGreaterThan(0);
  });
});
