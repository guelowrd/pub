// The splash riders and ribbon must stay on the painted scene whatever the canvas shape (2026-10-16: the overlay became the
// window and the riders walked in from outside the picture)
import { describe, expect, it } from "vitest";
import { frameOf, riderAt } from "./attract";

const SIZES: [number, number][] = [[1280, 960], [1490, 812], [1920, 1080], [390, 844], [740, 340]];

describe("attract geometry", () => {
  it("fits the 1280x960 frame inside any canvas, 4:3 and centred", () => {
    for (const [w, h] of SIZES) {
      const { k, ox, oy } = frameOf(w, h);
      expect(ox).toBeGreaterThanOrEqual(0); expect(oy).toBeGreaterThanOrEqual(0);
      expect(ox + 1280 * k).toBeCloseTo(w - ox, 6); expect(oy + 960 * k).toBeCloseTo(h - oy, 6);
      expect(Math.min(ox, oy)).toBeCloseTo(0, 6);
    }
    expect(frameOf(1280, 960)).toEqual({ k: 1, ox: 0, oy: 0 });
  });
  it("walks every rider from the far sidewalk to the door inside the frame, mirrored on odd periods", () => {
    for (const n of [0, 1, 2, 3]) for (let u = 0; u < 1; u += 0.01) {
      const r = riderAt(n, u);
      expect(r.gx).toBeGreaterThan(0); expect(r.gx).toBeLessThan(1280);
      expect(r.gy).toBeGreaterThan(0); expect(r.gy).toBeLessThan(960);
      expect(r.fromLeft).toBe(n % 2 === 1);
    }
    expect(riderAt(0, 0).gx).toBe(1280 - riderAt(1, 0).gx);
    expect(riderAt(0, 0.6).gy).toBeGreaterThan(riderAt(0, 0).gy); // they come down the sidewalk towards the car
    expect(riderAt(0, 0.8).alpha).toBe(0); // boarded
  });
});
