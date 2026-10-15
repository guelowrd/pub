import { describe, expect, it } from "vitest";
import { KMH, LANE, REV, RUN, TOP, W, WRECK, agePoints, newSim, step, type Input, type Sim } from "./sim";
import { extend } from "./course";

const idle: Input = { gas: false, brake: false, left: false, right: false };
const run = (s: Sim, inp: Partial<Input>, secs: number) => { for (let t = 0; t < secs; t += 1 / 120) step(s, { ...idle, ...inp }, 1 / 120, extend); };
const park = (s: Sim, z: number) => { s.z = z; s.x = W + 0.2; s.v = 0; };

describe("age points", () => {
  it("matches the designer's fixtures", () => {
    for (const [age, pts] of [[18, 0], [20, 0], [50, 600], [60, 800], [65, 900], [69, 980], [70, 1000], [80, 1000], [81, 950], [90, 500], [99, 50], [100, 0]])
      expect(agePoints(age)).toBe(pts);
  });
});

describe("driving", () => {
  it("reaches top speed and stops again", () => {
    const s = newSim(1);
    extend(s);
    s.dx.fill(0); // a straight: curves push an unsteered car into the curb
    run(s, { gas: true }, 8);
    expect(s.v).toBeCloseTo(TOP, 1);
    run(s, { brake: true }, 4);
    expect(s.v).toBeCloseTo(-REV, 1); // brake held through the stop: reversing
    const dist = s.dist;
    run(s, { brake: true }, 1);
    expect(s.dist).toBe(dist); // reversing earns nothing
    run(s, {}, 3);
    expect(s.v).toBe(0);
    expect(s.score).toBeGreaterThan(0);
  });
  it("clock ends the run and keeps riders aboard as lost", () => {
    const s = newSim(1);
    extend(s);
    s.seats[0] = { name: "RAY", age: 70, dest: "golf", lo: 68, hi: 72 };
    run(s, {}, RUN + 1);
    expect(s.over).toBe(true);
    expect(s.lost.map((r) => r.name)).toEqual(["RAY"]);
    expect(s.t).toBe(RUN);
  });
});

describe("hits", () => {
  it("a slow hit on traffic is a bump, a fast one wrecks and ejects riders", () => {
    const s = newSim(1);
    extend(s);
    s.seats[0] = { name: "RAY", age: 70, dest: "golf", lo: 68, hi: 72 };
    s.traffic = [{ z: s.z + 3, x: 0, tx: 0, v: 100 / KMH, cruise: 100 / KMH, kind: 0, braking: false }];
    s.v = 100 / KMH + WRECK - 1;
    step(s, idle, 1 / 120, extend);
    expect(s.spin).toBe(0);
    expect(s.seats[0]?.name).toBe("RAY");
    s.bumpCd = 0; s.traffic[0].z = s.z + 3; s.v = 100 / KMH + WRECK + 1;
    step(s, idle, 1 / 120, extend);
    expect(s.spin).toBeGreaterThan(0);
    expect(s.seats).toEqual([null, null, null]);
  });
});

describe("traffic", () => {
  it("changes lane for a hazard and brakes behind a slower car", () => {
    const s = newSim(1);
    extend(s);
    s.dx.fill(0);
    s.hazards = [{ z: 400, x: 0, kind: "cone", hit: false }];
    const car = { z: 350, x: 0, tx: 0, v: 100 / KMH, cruise: 100 / KMH, kind: 0, braking: false };
    const slow = { z: 420, x: LANE, tx: LANE, v: 50 / KMH, cruise: 50 / KMH, kind: 0, braking: false };
    s.traffic = [car, slow];
    run(s, {}, 2);
    expect(Math.abs(car.tx)).toBe(LANE); // moved out of the cone's lane
    run(s, {}, 2);
    if (car.tx === LANE) { expect(car.braking).toBe(true); expect(car.v).toBeLessThanOrEqual(slow.v + 0.01); }
    expect(s.hazards[0].hit).toBe(false);
  });
});

describe("stops", () => {
  it("boards only at rest with the door in the bay, once", () => {
    const s = newSim(1);
    extend(s);
    const st = s.stops.find((o) => o.rider)!;
    park(s, st.z + st.len / 2); s.v = 2;
    step(s, idle, 1 / 120, extend);
    expect(s.seats[0]).toBeNull();
    park(s, st.z + st.len / 2); s.x = 0;
    step(s, idle, 1 / 120, extend);
    expect(s.seats[0]).toBeNull();
    park(s, st.z - 1);
    step(s, idle, 1 / 120, extend);
    expect(s.seats[0]).toBeNull();
    park(s, st.z + 2);
    step(s, idle, 1 / 120, extend);
    expect(s.seats[0]).toBe(st.rider);
    expect(st.taken).toBe(true);
    run(s, {}, 2);
    expect(s.seats.filter(Boolean)).toHaveLength(1);
  });
  it("backs into a missed bay on the brake", () => {
    const s = newSim(1);
    extend(s);
    const st = s.stops.find((o) => o.rider)!;
    park(s, st.z + st.len + 12); s.v = 5;
    run(s, { brake: true, right: true }, 3); // past the bay, brake and steer into it, back up
    run(s, { right: true }, 2); // off the brake, it stops in the bay
    expect(s.seats[0]).toBe(st.rider);
    expect(s.z).toBeLessThanOrEqual(st.z + st.len);
  });
  it("drops the matching riders with the group multiplier and banks the award", () => {
    const s = newSim(1);
    extend(s);
    const f = s.forks[0];
    s.z = f.zDecide + 1; s.x = 1; step(s, idle, 1 / 120, extend);
    extend(s);
    const drop = s.stops.find((o) => o.drop)!;
    s.seats = [{ name: "A", age: 70, dest: drop.drop!, lo: 70, hi: 70 }, { name: "B", age: 60, dest: drop.drop!, lo: 60, hi: 60 }, { name: "C", age: 70, dest: f.side < 0 ? f.right : f.left, lo: 70, hi: 70 }];
    park(s, drop.z + drop.len / 2);
    step(s, idle, 1 / 120, extend);
    expect(s.banked).toBe((1000 + 800) * 1.5);
    expect(s.seats.filter(Boolean).map((r) => r!.name)).toEqual(["C"]);
  });
});

describe("fork", () => {
  it("locks the side you're on at the decision line and bends the road that way", () => {
    const s = newSim(1);
    extend(s);
    const f = s.forks[0];
    s.z = f.zDecide + 1; s.x = -3;
    step(s, idle, 1 / 120, extend);
    expect(f.side).toBe(-1);
    expect(s.x).toBeCloseTo(-3 + W);
    expect(s.dx[Math.floor(f.zDecide / 5) + 10]).toBeLessThan(0);
    expect(s.streets[1].district).toBe(f.left);
  });
});
