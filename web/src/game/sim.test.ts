import { describe, expect, it } from "vitest";
import { FAST, GREEN, KMH, LANE, RED, REV, RUN, TOP, W, WRECK, agePoints, newSim, step, type District, type Input, type Rider, type Sim } from "./sim";
import { extend } from "./course";

const idle: Input = { gas: false, brake: false, left: false, right: false };
const run = (s: Sim, inp: Partial<Input>, secs: number) => { for (let t = 0; t < secs; t += 1 / 120) step(s, { ...idle, ...inp }, 1 / 120, extend); };
const park = (s: Sim, z: number) => { s.z = z; s.x = W + 0.2; s.v = 0; };
const R = (name: string, age: number, dest: District): Rider => ({ id: name.toLowerCase(), name, age, dest, lo: age, hi: age, cls: "TIGHT" });

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
    s.dx.fill(0); s.hazards = []; // a clear straight: curves push an unsteered car into the curb, cones slow it
    run(s, { gas: true }, 8);
    expect(s.v).toBeGreaterThan(FAST); // 220 comes in under 8 s
    run(s, { gas: true }, 4);
    expect(s.v).toBeGreaterThan(250 / KMH); // 12 s in; the last stretch to 299 takes a long straight
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
    s.seats[0] = R("RAY", 70, "golf");
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
    s.seats[0] = R("RAY", 70, "golf");
    s.traffic = [{ z: s.z + 3, x: 0, tx: 0, v: 100 / KMH, cruise: 100 / KMH, kind: 0, braking: false }];
    s.v = 100 / KMH + WRECK - 1;
    step(s, idle, 1 / 120, extend);
    expect(s.spin).toBe(0);
    expect(s.seats[0]?.name).toBe("RAY");
    s.bumpCd = 0; s.traffic[0].z = s.z + 3; s.v = 100 / KMH + WRECK + 1;
    step(s, idle, 1 / 120, extend);
    expect(s.spin).toBeGreaterThan(0);
    expect(s.seats).toEqual([null, null, null]);
    expect(s.bailed.map((r) => r.name)).toEqual(["RAY"]); // the recap crosses them out, like the ones aboard at time-up
    expect(s.lost).toEqual([]);
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
  it("queues at a red light and goes on green", () => {
    const s = newSim(1);
    extend(s);
    s.dx.fill(0);
    s.lights = [{ z: 300, offset: RED + GREEN - 1 }]; // turns red at t = 1, as the car gets there
    const car = { z: 270, x: 0, tx: 0, v: 50 / KMH, cruise: 50 / KMH, kind: 0, braking: false };
    s.traffic = [car];
    run(s, {}, 2.5);
    expect(car.v).toBe(0);
    expect(car.z).toBeGreaterThan(270);
    expect(car.z).toBeLessThan(300);
    run(s, {}, 4);
    expect(car.z).toBeGreaterThan(275);
  });
});

describe("curbs", () => {
  it("bite harder downtown than on the golf grass", () => {
    const v = (d: Sim["streets"][0]["district"]) => {
      const s = newSim(1);
      extend(s);
      s.streets[0].district = d; s.x = W + 5; s.v = 20;
      step(s, idle, 1 / 120, extend);
      return s.v;
    };
    expect(v("downtown")).toBeLessThan(v("golf"));
    expect(v("golf")).toBeLessThan(20);
  });
});

describe("stops", () => {
  it("boards only at rest with the door in the bay, once", () => {
    const s = newSim(1);
    extend(s);
    const st = s.stops.find((o) => o.rider && o.side > 0)!;
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
  it("boards at a left-curb bay with the left door in it", () => {
    const s = newSim(1);
    extend(s);
    const st = s.stops.find((o) => o.rider && o.side < 0) ?? s.stops.find((o) => o.rider && o.venue === "market")!;
    st.side = -1;
    park(s, st.z + 10); s.x = W + 0.2;
    step(s, idle, 1 / 120, extend);
    expect(s.seats[0]).toBeNull(); // right door in the right lane: wrong curb
    s.x = -(W + 0.2);
    step(s, idle, 1 / 120, extend);
    expect(s.seats[0]).toBe(st.rider);
  });
  it("backs into a missed bay on the brake", () => {
    const s = newSim(1);
    extend(s);
    s.dx.fill(0); s.hazards = [];
    const st = s.stops.find((o) => o.rider && o.side > 0)!;
    park(s, st.z + st.len + 12); s.v = 5;
    run(s, { brake: true }, 3.5); // past the bay, brake, back up
    run(s, { right: true }, 2); // off the brake, steer into the bay, it stops
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
    s.seats = [R("A", 70, drop.drop!), R("B", 60, drop.drop!), R("C", 70, f.side < 0 ? f.right : f.left)];
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
    expect(s.dx[Math.floor(f.zDecide / 5) + 4]).toBeLessThan(0); // the outward half of the S
    expect(s.streets[1].district).toBe(f.left);
  });
  it("takes the traffic ahead into the branch's frame: the far-side car is gone, the others settle into lanes", () => {
    const s = newSim(1);
    extend(s);
    const f = s.forks[0], car = (x: number, z: number) => ({ z, x, tx: x, v: 20, cruise: 20, kind: 0, braking: false });
    s.z = f.zDecide + 1; s.x = 3; s.hazards = []; s.lights = []; // going right, nothing else to swerve for
    s.traffic = [car(LANE, f.zDecide + 150), car(0, f.zDecide + 200), car(-LANE, f.zDecide + 250), car(0, f.zDecide - 50)];
    step(s, idle, 1 / 120, extend);
    expect(f.side).toBe(1);
    const want = [[150, LANE - W, 0], [200, -W, -LANE]]; // no sideways jump in our frame; the -LANE car went left
    const mine = s.traffic.filter((c) => c.z > s.z && c.z < f.zDecide + 300); // extend() may have spawned one far ahead
    expect(mine.length).toBe(2);
    mine.forEach((c, i) => { expect(Math.round(c.z - f.zDecide)).toBe(want[i][0]); expect(c.x).toBeCloseTo(want[i][1], 1); expect(c.tx).toBeCloseTo(want[i][2]); });
    expect(s.traffic.find((c) => c.z < s.z)!.x).toBeCloseTo(0, 1); // the car behind us stays put (it may change lane to pass)
  });
});

describe("steering", () => {
  it("lags behind the stick", () => {
    const s = newSim(1);
    extend(s);
    s.dx.fill(0); s.v = 20;
    const x0 = s.x;
    run(s, { right: true }, 0.05);
    expect(s.steer).toBeGreaterThan(0.2);
    expect(s.steer).toBeLessThan(0.6);
    run(s, { right: true }, 0.5);
    expect(s.steer).toBeCloseTo(1, 1);
    expect(s.x).toBeGreaterThan(x0 + 1);
  });
});

describe("speed", () => {
  it("turning flat out scrubs speed, and the wheel answers slower", () => {
    const s = newSim(1);
    extend(s);
    s.dx.fill(0); s.v = TOP; s.x = 0;
    run(s, { gas: true, right: true }, 0.05);
    expect(s.steer).toBeLessThan(0.2); // slower than the 0.33 it reaches at 20 m/s
    run(s, { gas: true, left: true, right: true }, 0); // no net steer, just to keep typing honest
    s.x = 0;
    run(s, { gas: true, right: true }, 1);
    expect(s.v).toBeLessThan(TOP - 5); // lost more than 18 km/h in a second of full lock
  });
});
