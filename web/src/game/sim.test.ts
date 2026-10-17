import { describe, expect, it } from "vitest";
import { BAY, FAST, GREEN, KMH, LANE, RED, REV, RUN, TOP, W, WRECK, agePoints, branchX, candidate, edges, isRed, leftEdge, newSim, rightEdge, step, windOf, type District, type Input, type Rider, type Sim } from "./sim";
import { MOUTHS, extend } from "./course";

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
  it("choosing a side with a rider aboard for it says the drop-off is after the tunnel", () => {
    const s = newSim(1);
    extend(s);
    const f = s.forks[0];
    s.seats[0] = R("A", 70, f.left);
    s.z = f.zDecide + 1; s.x = -3; step(s, idle, 1 / 120, extend); // left it is
    expect(s.callout?.text).toBe("DROP OFF AFTER THE TUNNEL!");
  });
  it("says nothing at the choice when nobody aboard wants that street", () => {
    const s = newSim(1);
    extend(s);
    const f = s.forks[0];
    s.seats[0] = R("A", 70, f.right);
    s.z = f.zDecide + 1; s.x = -3; step(s, idle, 1 / 120, extend);
    expect(s.callout?.text ?? "").not.toMatch(/DROP OFF/);
  });
  it("locks the side you're on at the decision line; the frame shifts onto your bore at its mouth, not before", () => {
    const s = newSim(1);
    extend(s);
    const f = s.forks[0];
    s.z = f.zDecide + 1; s.x = -3;
    step(s, idle, 1 / 120, extend);
    expect(f.side).toBe(-1);
    expect(s.x).toBeCloseTo(-3); // nothing moves at the line
    expect(f.shifted).toBe(false);
    expect(s.streets[1].district).toBe(f.left);
    // the edges are the left branch's as it sweeps away
    const z = f.zDecide + 50, c = branchX(f, z, -1);
    expect(c).toBeLessThan(-W);
    expect(edges(s, z)).toEqual([c - W, c + W]);
    s.z = f.mouth - 0.5; s.x = branchX(f, f.mouth, -1); s.v = 0; // on the bore's centre line
    expect(s.x).toBeCloseTo(-MOUTHS / 2, 3);
    step(s, idle, 1 / 120, extend);
    expect(f.shifted).toBe(false);
    s.z = f.mouth + 0.5;
    step(s, idle, 1 / 120, extend);
    expect(f.shifted).toBe(true);
    expect(s.x).toBeCloseTo(0, 1); // the bore is now the axis
    expect(edges(s, f.mouth + 20)).toEqual([-W, W]);
  });
  it("traffic through the split follows its branch, and comes along when the frame shifts at the mouth", () => {
    const s = newSim(1);
    extend(s);
    const f = s.forks[0], car = (x: number, z: number) => ({ z, x, tx: x, v: 20, cruise: 20, kind: 0, braking: false });
    s.z = f.zDecide + 1; s.x = 3; s.hazards = []; s.lights = []; // going right
    s.traffic = [car(LANE, f.zDecide + 10), car(-LANE, f.zDecide + 10)];
    run(s, {}, 1);
    const [r, l] = s.traffic;
    expect(r.branch).toBe(1); expect(l.branch).toBe(-1);
    expect(Math.abs(r.x - branchX(f, r.z, 1))).toBeCloseTo(LANE, 0); // each rides a lane of its branch (the trunk's outer lanes snap to the branches' inner ones)
    expect(Math.abs(l.x - branchX(f, l.z, -1))).toBeCloseTo(LANE, 0);
    // at the mouth the frame shifts onto the right bore: the right car is at x ~ 0 there, the left one is gone
    s.z = f.mouth + 0.5; s.x = branchX(f, f.mouth, 1); s.v = 0;
    r.z = f.mouth + 60; l.z = f.mouth + 60; r.x = r.tx = branchX(f, r.z, 1); l.x = l.tx = branchX(f, l.z, -1);
    s.hazards = []; s.lights = []; // the new street's hazards would make it change lane
    step(s, idle, 1 / 120, extend);
    expect(f.shifted).toBe(true);
    expect(s.traffic.length).toBe(1);
    expect(s.traffic[0].x).toBeCloseTo(0, 1);
  });
});

describe("hazards", () => {
  const hz = (kind: "cone" | "oil" | "pothole" | "barrier", s: Sim) => ({ z: s.z, x: 0, kind, hit: false });
  it("cones and potholes scrub speed once; oil stays slick and is hit again", () => {
    const s = newSim(1);
    extend(s);
    s.hazards = [hz("cone", s)]; s.v = 20; step(s, idle, 1 / 120, extend);
    expect(s.v).toBeCloseTo(14, 0); expect(s.hazards[0].hit).toBe(true);
    s.hazards = [hz("pothole", s)]; s.v = 20; const x0 = s.x; step(s, idle, 1 / 120, extend);
    expect(s.v).toBeCloseTo(14, 0); expect(Math.abs(s.x - x0)).toBeGreaterThanOrEqual(0.8); // a jolt sideways too
    s.hazards = [hz("oil", s)]; s.v = 20; step(s, idle, 1 / 120, extend);
    expect(s.oil).toBeGreaterThanOrEqual(2); expect(s.hazards[0].hit).toBe(false);
  });
  it("rain: braking and the wheel's bite drop, a curve throws harder, and the crosswind leans on the car", () => {
    // SYNTHWAVE ENGINE (1) and ABANDONED FACTORY (2) both start downtown: the same course, dry and wet
    const mk = (song: number) => { const s = newSim(1, song); extend(s); s.dx.fill(0); s.hazards = []; s.traffic = []; s.lights = []; return s; };
    const dry = mk(1), wet = mk(2);
    expect(wet.rain).toBe(true); expect(dry.rain).toBe(false); expect(Math.abs(windOf(wet))).toBe(1); expect(windOf(dry)).toBe(0);
    for (const s of [dry, wet]) { s.v = 30; } run(dry, { brake: true }, 0.5); run(wet, { brake: true }, 0.5);
    expect(wet.v).toBeGreaterThan(dry.v + 2);
    for (const s of [dry, wet]) { s.v = 30; s.x = 0; s.steer = 1; } run(dry, { right: true }, 0.5); run(wet, { right: true }, 0.5);
    expect(wet.x - windOf(wet) * 0.5).toBeLessThan(dry.x * 0.9); // less bite, the wind's own push taken out
    for (const s of [dry, wet]) { s.v = 30; s.x = 0; s.steer = 0; } run(dry, {}, 1); run(wet, {}, 1);
    expect(dry.x).toBe(0); expect(Math.sign(wet.x)).toBe(windOf(wet)); expect(Math.abs(wet.x)).toBeGreaterThan(0.2);
  });
  it("oil cuts the wheel's bite", () => {
    const dry = newSim(1), wet = newSim(1);
    for (const s of [dry, wet]) { extend(s); s.dx.fill(0); s.hazards = []; s.v = 30; s.steer = 1; }
    wet.oil = 5;
    const x0 = dry.x, x1 = wet.x;
    run(dry, { right: true }, 0.5); run(wet, { right: true }, 0.5);
    expect(wet.x - x1).toBeLessThan((dry.x - x0) * 0.6);
  });
  it("a barrier spins you out when slow and wrecks you when fast; the top speed never drops below FAST", () => {
    const s = newSim(1);
    extend(s);
    s.hazards = [hz("barrier", s)]; s.v = WRECK - 1; step(s, idle, 1 / 120, extend);
    expect(s.spin).toBe(0); expect(s.v).toBeCloseTo((WRECK - 1) * 0.2, 1); expect(s.callout?.text).toBe("SPIN OUT!");
    s.seats[0] = R("RAY", 70, "golf"); s.cap = FAST + 5 / KMH;
    s.hazards = [hz("barrier", s)]; s.v = WRECK + 5; step(s, idle, 1 / 120, extend);
    expect(s.spin).toBeGreaterThan(0); expect(s.cap).toBe(FAST); // 15 km/h off, floored at FAST
    expect(s.seats).toEqual([null, null, null]); expect(s.bailed.map((r) => r.name)).toEqual(["RAY"]);
  });
});

describe("reversing", () => {
  it("backing into a car behind stops you against it", () => {
    const s = newSim(1);
    extend(s);
    s.hazards = []; s.v = -3;
    s.traffic = [{ z: s.z - 2, x: 0, tx: 0, v: 0, cruise: 0, kind: 0, braking: false }];
    step(s, idle, 1 / 120, extend);
    expect(s.v).toBe(0);
    expect(s.z).toBeCloseTo(s.traffic[0].z + 4.5, 1); // a car length behind its tail
  });
});

describe("edges", () => {
  it("widen from one road to two across the fork's approach, and a bay adds to its side", () => {
    const s = newSim(1);
    extend(s);
    const f = s.forks[0];
    expect(edges(s, f.z)).toEqual([-W, W]);
    expect(edges(s, f.zDecide - 1)[1]).toBeCloseTo(2 * W, 0);
    const bay = s.stops.find((o) => o.side > 0 && !o.drop)!;
    expect(rightEdge(s, bay.z + 1)).toBeCloseTo(W + BAY);
    expect(leftEdge(s, bay.z + 1)).toBeCloseTo(W);
  });
});

describe("radar", () => {
  it("candidate() is the next stop still open, kept until ten metres past it", () => {
    const s = newSim(1);
    extend(s);
    const [a, b] = s.stops;
    s.z = a.z - 100; expect(candidate(s)).toBe(a);
    s.z = a.z + a.len + 5; expect(candidate(s)).toBe(a);
    s.z = a.z + a.len + 11; expect(candidate(s)).not.toBe(a);
    s.z = b.z - 100; expect(candidate(s)).toBe(b); // a is behind by then
    a.taken = true; s.z = a.z - 100; expect(candidate(s)).not.toBe(a); // and never a taken one
    expect(candidate(s)).toBe(b.z < s.z + 250 ? b : undefined); // only within the radar's reach
  });
  it("isRed() cycles RED then GREEN seconds, shifted by the light's offset", () => {
    expect(isRed({ z: 0, offset: 0 }, 0)).toBe(true);
    expect(isRed({ z: 0, offset: 0 }, RED - 0.01)).toBe(true);
    expect(isRed({ z: 0, offset: 0 }, RED)).toBe(false);
    expect(isRed({ z: 0, offset: 0 }, RED + GREEN)).toBe(true);
    expect(isRed({ z: 0, offset: RED }, 0)).toBe(false);
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
