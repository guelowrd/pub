import { describe, expect, it } from "vitest";
import { DISTRICTS, agePoints, type District } from "./sim";
import { CHARACTERS, LEGS, POOLS, VENUES, pyramid } from "./course";

describe("course", () => {
  it("same seed, same course; another seed, another course", () => {
    expect(JSON.stringify(pyramid(1))).toBe(JSON.stringify(pyramid(1)));
    expect(JSON.stringify(pyramid(1))).not.toBe(JSON.stringify(pyramid(2)));
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
          expect(n.stops.length).toBeGreaterThanOrEqual(3);
          for (const st of n.stops) {
            expect(VENUES[n.district]).toContain(st.venue);
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
    const expected = Object.fromEntries(DISTRICTS.map((d) => [d, (mean(VENUES[d][0]) + mean(VENUES[d][1])) / 2])) as Record<District, number>;
    const xs = Object.values(expected);
    expect(Math.max(...xs) / Math.min(...xs)).toBeLessThan(1.35);
  });
});
