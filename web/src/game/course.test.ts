import { STATIONS } from "./stations";
import { describe, expect, it } from "vitest";
import { DISTRICTS, LANE, agePoints, branchX, newSim, step, type District, type Input } from "./sim";
const idle: Input = { gas: false, brake: false, left: false, right: false };
import { SLOTS } from "./chain";
import { CHARACTERS, FORK_OUT, LEGS, MOUTHS, POOLS, VENUES, VENUE_OF, extend, pyramid } from "./course";

describe("course", () => {
  it("a song's feel sets the hazards, their kinds, the curves and the hills; every waterfront street rises", () => {
    const by = (song: number) => pyramid(7, song).flat();
    const cruise = by(11), crush = by(12), factory = by(2), pulse = by(4); // NIGHT CRUISE, PICK UP OR CRUSH UP, ABANDONED FACTORY, OUTRUN PULSE
    const count = (ns: typeof cruise) => ns.reduce((a, n) => a + n.hazards.length, 0);
    expect(count(crush)).toBeGreaterThan(count(cruise) * 3);
    expect(cruise.every((n) => n.hazards.every((h) => h.kind === "cone"))).toBe(true);
    expect(factory.some((n) => n.hazards.some((h) => h.kind === "barrier"))).toBe(true);
    const steepest = (ns: typeof cruise) => Math.max(...ns.flatMap((n) => n.curves.map((c) => Math.abs(c[2]))));
    expect(steepest(pulse)).toBeGreaterThan(steepest(cruise));
    expect(steepest(pulse)).toBeLessThanOrEqual(0.05 * 1.5 + 1e-9);
    for (const n of [...cruise, ...crush, ...factory, ...pulse].filter((o) => o.district === "waterfront")) {
      expect(n.hills.length).toBeGreaterThan(0); expect(n.hills.every((h) => h[2] > 0)).toBe(true);
    }
  });
  it("same seed, same course; another seed, another course", () => {
    expect(JSON.stringify(pyramid(1))).toBe(JSON.stringify(pyramid(1)));
    expect(JSON.stringify(pyramid(1))).not.toBe(JSON.stringify(pyramid(2)));
    STATIONS.forEach((st, song) => expect(pyramid(1, song)[0][0].district).toBe(st.district)); // the song picks the first street
  });
  it("spawns traffic past a decided split on the chosen branch, following it until the mouth", () => {
    const s = newSim(1);
    extend(s);
    const f = s.forks[0];
    s.z = f.zDecide + 1; s.x = 2; step(s, idle, 1 / 120, extend); // choose right
    expect(f.side).toBe(1);
    s.z = f.zDecide - 760; s.traffic = []; s.rng = () => 0.1; // the spawn lands 40 m past the line, in the left trunk lane
    extend(s);
    const c = s.traffic.find((o) => o.z > f.zDecide)!;
    expect(c.branch).toBe(1);
    expect(c.x - branchX(f, c.z, 1)).toBeCloseTo(-LANE, 5);
  });
  it("sweeps the branches to the mouth spacing and runs them parallel after", () => {
    const s = newSim(1);
    extend(s);
    const f = s.forks[0], mouth = (FORK_OUT / 2) / 5;
    expect(f.off[mouth] * 2).toBeCloseTo(MOUTHS, 3);
    expect(f.off[mouth + 20] - f.off[mouth + 10]).toBeCloseTo(0, 6); // no heading left after the mouth
    const curv = (i: number) => f.off[i + 1] - 2 * f.off[i] + f.off[i - 1];
    expect(curv(3)).toBeGreaterThan(0); // out...
    expect(curv(mouth - 3)).toBeLessThan(0); // ...then back to straight
  });
  it("forks offer two other districts, riders are authored characters who want another district", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const c = pyramid(seed);
      expect(c).toHaveLength(LEGS);
      c.forEach((row, leg) => {
        expect(row).toHaveLength(leg + 1);
        row.forEach((n, k) => {
          if (leg + 1 < LEGS) {
            const [l, r] = [c[leg + 1][k].district, c[leg + 1][k + 1].district];
            expect(l).not.toBe(n.district); expect(r).not.toBe(n.district); expect(l).not.toBe(r);
          }
          expect(n.stops.length).toBeGreaterThanOrEqual(leg ? 4 : 3);
          expect(n.stops.length).toBeLessThanOrEqual(SLOTS); // packCourse throws past this
          if (leg) expect(n.stops[0].venue).toBe(VENUE_OF[n.district]);
          for (const st of n.stops) {
            expect([...VENUES[n.district], VENUE_OF[n.district]]).toContain(st.venue);
            expect(st.rider.dest).not.toBe(n.district);
            expect(st.rider.age).toBe(CHARACTERS[st.rider.id].age);
            expect(st.rider.lo).toBeLessThanOrEqual(st.rider.age);
            expect(st.rider.hi).toBeGreaterThanOrEqual(st.rider.age);
          }
        });
      });
    }
  });
  it("no district's venues pay clearly more than another's", () => {
    const mean = (venue: string) => {
      const pool = POOLS[venue], w = pool.reduce((a, c) => a + c.relative_weight, 0);
      return pool.reduce((a, c) => a + c.relative_weight * agePoints(CHARACTERS[c.character_id].age), 0) / w;
    };
    const expected = Object.fromEntries(DISTRICTS.map((d) => [d, (mean(VENUES[d][0]) + mean(VENUES[d][1]) + mean(VENUE_OF[d])) / 3])) as Record<District, number>;
    const xs = Object.values(expected);
    expect(Math.max(...xs) / Math.min(...xs)).toBeLessThan(1.35);
  });
});
