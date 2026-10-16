import { STATIONS } from "./stations";
import { describe, expect, it } from "vitest";
import { DISTRICTS, agePoints, newSim, type District } from "./sim";
import { SLOTS } from "./chain";
import { CHARACTERS, FORK_OUT, LEGS, MOUTHS, POOLS, VENUES, VENUE_OF, extend, pyramid } from "./course";

describe("course", () => {
  it("same seed, same course; another seed, another course", () => {
    expect(JSON.stringify(pyramid(1))).toBe(JSON.stringify(pyramid(1)));
    expect(JSON.stringify(pyramid(1))).not.toBe(JSON.stringify(pyramid(2)));
    STATIONS.forEach((st, song) => expect(pyramid(1, song)[0][0].district).toBe(st.district)); // the song picks the first street
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
