// The run: car, road, traffic, stops, clock, score. Pure state + step(), no DOM.
// Units: metres, seconds, m/s. z runs along the road, x across it (0 = road centre, right positive).

export const KMH = 3.6;
export const TOP = 299 / KMH; // top speed; the power tapers, so 220 comes easy and the last 80 are earned
export const FAST = 220 / KMH; // where the curves start to throw you and the wheel gets lazy
export const REV = 20 / KMH; // reverse speed, brake held at a standstill
export const WRECK = 60 / KMH; // closing speed above which a hit is a wreck
export const SEG = 5; // road segment length
export const LANE = 3.5;
export const W = (LANE * 3) / 2; // half road width, three lanes
export const BAY = 2.5; // a bay widens the road to the right by this
export const WALK = 3; // sidewalk width
export const RUN = 180; // active seconds
export const RATE = 0.5; // distance points per metre (sized in M2)
export const CAR_LEN = 4.5;
export const CAR_W = 2;

export type District = "downtown" | "waterfront" | "casino" | "golf";
export const DISTRICTS: District[] = ["downtown", "waterfront", "casino", "golf"];
export const NAME: Record<District, string> = { downtown: "DOWNTOWN", waterfront: "WATERFRONT", casino: "CASINO STRIP", golf: "GOLF HILLS" };
export const PLACE: Record<District, string> = { downtown: "RESTAURANT", waterfront: "CRUISE", casino: "CASINO", golf: "GOLF" };
export const CURB: Record<District, number> = { downtown: 3, casino: 2, waterfront: 1.5, golf: 1 }; // scrape drag per second: city curbs bite, golf is grass
export const LIGHTS: Record<District, number> = { downtown: 3, casino: 2, waterfront: 0, golf: 0 }; // traffic lights per street
export const RED = 2, GREEN = 10; // light cycle, seconds

export type RadarClass = "TIGHT" | "FUZZY" | "WILD";
export interface Rider { id: string; name: string; age: number; dest: District; lo: number; hi: number; cls: RadarClass }
// i: index among the street's rider stops (the decision log names a pickup by it); venue: where they wait
export interface Stop { z: number; len: number; rider: Rider | null; drop: District | null; taken: boolean; i: number; venue: string | null }
// one street of the pyramid, positions relative to its start; placed on the road when you turn into it
export interface Node { district: District; stops: { z: number; venue: string; rider: Rider }[]; hazards: Hazard[]; lights: [number, number][]; curves: [number, number, number][]; hills: [number, number, number][] }
// the decision log: what the chain replays. t in 10 ms ticks
export type Event = { k: "fork"; side: -1 | 1; t: number } | { k: "pick"; stop: number; t: number } | { k: "drop"; t: number } | { k: "wreck"; t: number };
// tx: the lane it's moving to; cruise: its own speed when the lane is clear
export interface Traffic { z: number; x: number; tx: number; v: number; cruise: number; kind: number; braking: boolean }
export type HazardKind = "cone" | "oil" | "pothole" | "barrier";
export interface Hazard { z: number; x: number; kind: HazardKind; hit: boolean }
// k: curvature of the right branch per segment from the decision line; off: that branch's offset from the trunk
export interface Fork { z: number; zDecide: number; zEnd: number; left: District; right: District; side: -1 | 0 | 1; k: number[]; off: number[] }
export interface Street { z0: number; z1: number; district: District; leg: number; k: number }
export interface Light { z: number; offset: number } // red when (t + offset) % (RED + GREEN) < RED
export interface Input { gas: boolean; brake: boolean; left: boolean; right: boolean }

export interface Sim {
  seed: number;
  rng: () => number;
  t: number; // active seconds elapsed
  over: boolean;
  z: number; x: number; v: number;
  steer: number; // -1..1, what the player holds
  brake: boolean;
  skid: boolean;
  hot: number; // seconds since the car last ran above 60 km/h; a stop within 2.5 s of that is a crazy stop
  spin: number; // seconds of spin-out left
  oil: number; // seconds of grip loss left
  boarding: number; // seconds the car stays put while someone gets in or out
  bumpCd: number;
  seats: (Rider | null)[];
  banked: number; dist: number; score: number; delivered: number;
  dx: number[]; // per segment: curvature, OutRun style (how much the lateral shift grows each segment)
  y: number[]; // per segment: road height (hills are visual only, like OutRun)
  course: Node[][]; // the pyramid, course[leg][k], all from the seed
  streets: Street[]; stops: Stop[]; hazards: Hazard[]; traffic: Traffic[]; forks: Fork[]; lights: Light[];
  callout: { text: string; t: number } | null;
  lost: Rider[]; // aboard at time-up
  log: Event[]; // the decision log
}

export function agePoints(age: number): number {
  if (age < 70) return Math.max(0, 1000 - 20 * (70 - age));
  if (age > 80) return Math.max(0, 1000 - 50 * (age - 80));
  return 1000;
}
export const GROUP = [0, 1, 1.5, 2];

// mulberry32
export function rngFrom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSim(seed: number): Sim {
  return {
    seed, rng: rngFrom(seed), t: 0, over: false,
    z: 20, x: 0, v: 0, steer: 0, brake: false, skid: false, hot: 99, spin: 0, oil: 0, boarding: 0, bumpCd: 0,
    seats: [null, null, null], banked: 0, dist: 0, score: 0, delivered: 0,
    dx: [], y: [], course: [], streets: [], stops: [], hazards: [], traffic: [], forks: [], lights: [],
    callout: null, lost: [], log: [],
  };
}

export const seg = (z: number) => Math.floor(z / SEG);
export const curvature = (s: Sim, z: number) => s.dx[seg(z)] ?? 0;
export const districtAt = (s: Sim, z: number) => s.streets.find((st) => z >= st.z0 && z < st.z1)?.district;
export const isRed = (l: Light, t: number) => (t + l.offset) % (RED + GREEN) < RED;
export const tick = (s: Sim) => Math.round(s.t * 100);

export function activeFork(s: Sim, z: number): Fork | undefined {
  return s.forks.find((f) => z >= f.z && z < f.zEnd);
}
export function stopAt(s: Sim, z: number): Stop | undefined {
  return s.stops.find((st) => z >= st.z && z < st.z + st.len);
}
// right road edge; left is always -halfWidth(z)
export function halfWidth(s: Sim, z: number): number {
  const f = activeFork(s, z);
  if (f && f.side === 0 && z < f.zDecide) return W + (W * (z - f.z)) / (f.zDecide - f.z); // the trunk widens to two roads
  return W;
}
export function rightEdge(s: Sim, z: number): number {
  return halfWidth(s, z) + (stopAt(s, z) ? BAY : 0);
}

function say(s: Sim, text: string, t = 1.2) {
  s.callout = { text, t };
}

function wreck(s: Sim) {
  s.spin = 2.5;
  s.skid = false;
  say(s, s.seats.some(Boolean) ? "WRECK! RIDERS BAILED" : "WRECK!", 2);
  s.seats = [null, null, null];
  s.log.push({ k: "wreck", t: tick(s) });
}

export function step(s: Sim, inp: Input, dt: number, extend: (s: Sim) => void) {
  if (s.over) return;
  s.t += dt;
  if (s.t >= RUN) {
    s.t = RUN; s.over = true;
    s.lost = s.seats.filter((r): r is Rider => r !== null);
    return;
  }
  extend(s);
  if (s.callout && (s.callout.t -= dt) <= 0) s.callout = null;
  s.bumpCd = Math.max(0, s.bumpCd - dt);
  s.oil = Math.max(0, s.oil - dt);
  s.hot = s.v > 60 / KMH ? 0 : s.hot + dt;

  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  // the wheel takes a beat to turn, and more of a beat the faster you go: at the top it answers in a third of a second
  s.steer += (dir - s.steer) * Math.min(1, 8 * (1 - 0.6 * (Math.abs(s.v) / TOP) ** 2) * dt);
  s.brake = inp.brake;
  if (s.spin > 0) {
    s.spin -= dt;
    s.v = Math.max(0, s.v - 22 * dt);
    s.x += (s.spin > 1.5 ? 1 : 0) * 3 * dt; // slides outward a little
  } else if (s.boarding > 0) {
    s.boarding -= dt;
    s.v = 0;
  } else {
    // brake through a standstill and you reverse: the reflex when you've overshot a stop
    if (inp.brake) s.v = Math.max(-REV, s.v - (s.v > 0 ? 28 : 8) * dt);
    else if (inp.gas) s.v = Math.min(TOP, s.v + (13 * (1 - (Math.max(0, s.v) / TOP) ** 3) + 0.5) * dt);
    if (s.v > 0 && dir !== 0) s.v -= Math.abs(s.steer) * (s.v / TOP) ** 3 * 10 * dt; // turning at speed scrubs it off, hard when flat out
    else s.v -= Math.sign(s.v) * Math.min(Math.abs(s.v), 4 * dt);
    s.skid = inp.brake && dir !== 0 && s.v > 15;
    const lat = s.steer * (4 + 10 * (s.v / TOP)) * (s.skid ? 1.5 : 1) * (s.oil > 0 ? 0.4 : 1);
    s.x += lat * dt;
    if (s.oil > 0) s.x += (s.rng() - 0.5) * 12 * dt;
  }
  s.x -= curvature(s, s.z) * (s.v / FAST) ** 2 * 75 * dt; // the curve throws you outward; hold the wheel against it; past 220 it is dangerous

  // curbs are walls: scrape and slow, harder in the city
  const r = rightEdge(s, s.z), l = -halfWidth(s, s.z), curb = CURB[districtAt(s, s.z) ?? "golf"];
  if (s.x + CAR_W / 2 > r) { s.x = r - CAR_W / 2; s.v *= 1 - curb * dt; }
  if (s.x - CAR_W / 2 < l) { s.x = l + CAR_W / 2; s.v *= 1 - curb * dt; }

  s.z += s.v * dt;
  s.dist += Math.max(0, s.v) * dt;

  // fork: crossing the decision line picks the side you're on, then you ride that branch
  for (const f of s.forks) {
    if (f.side === 0 && s.z >= f.zDecide) {
      f.side = s.x < 0 ? -1 : 1;
      s.x -= f.side * W;
      const d = seg(f.zDecide);
      f.k.forEach((k, i) => { s.dx[d + i] = f.side * k; });
      s.log.push({ k: "fork", side: f.side, t: tick(s) });
      extend(s); // the chosen street is built now
    }
  }

  // traffic drives by the same rules as you: it brakes behind slower cars, stops at red lights, moves out of the way of hazards
  const blockers = [
    ...s.traffic, { z: s.z, x: s.x, v: Math.max(0, s.v) },
    ...s.hazards.filter((h) => !h.hit).map((h) => ({ z: h.z, x: h.x, v: 0 })),
    ...s.lights.filter((l) => isRed(l, s.t)).flatMap((l) => [-LANE, 0, LANE].map((x) => ({ z: l.z, x, v: 0 }))),
  ];
  for (const c of s.traffic) {
    const inLane = (x: number, o: { x: number }) => Math.abs(o.x - x) < LANE * 0.8;
    const ahead = blockers.find((o) => o !== c && o.z > c.z && o.z - c.z < 90 && inLane(c.tx, o));
    if (ahead) {
      const free = [c.tx - LANE, c.tx + LANE].filter((x) => Math.abs(x) <= LANE + 0.1 && !blockers.some((o) => o !== c && inLane(x, o) && o.z - c.z > -30 && o.z - c.z < 90));
      if (free.length) c.tx = free[Math.floor(s.rng() * free.length)];
    }
    // brake when the gap is shorter than the stopping distance at 10 m/s² plus a car length or two
    c.braking = !!ahead && ahead.v < c.v + 1 && ahead.z - c.z < 8 + Math.max(0, c.v ** 2 - ahead.v ** 2) / 20;
    c.v = c.braking ? Math.max(c.v - 10 * dt, Math.min(ahead!.v, c.v)) : Math.min(c.v + 3 * dt, c.cruise);
    c.x += Math.max(-3 * dt, Math.min(3 * dt, c.tx - c.x));
    c.z += c.v * dt;
    if (s.bumpCd === 0 && Math.abs(c.x - s.x) < CAR_W && Math.abs(c.z - s.z) < CAR_LEN) {
      if (c.z < s.z) { // it ran into us: it stops. We backed into it: we stop
        if (s.v < 0) { s.v = 0; s.z = c.z + CAR_LEN; } else { c.v = s.v; c.z = s.z - CAR_LEN; }
        continue;
      }
      if (s.v - c.v > WRECK) wreck(s);
      else { s.v = Math.min(s.v, c.v * 0.85); s.x += (s.x < c.x ? -1 : 1) * 0.8; say(s, "BUMP"); }
      s.bumpCd = 0.6;
    }
  }
  s.traffic = s.traffic.filter((c) => c.z > s.z - 60 && c.z < s.z + 1300);

  // hazards
  for (const h of s.hazards) {
    if (h.hit || Math.abs(h.z - s.z) > 3 || Math.abs(h.x - s.x) > 1.8) continue;
    h.hit = true;
    if (h.kind === "cone") s.v *= 0.7;
    else if (h.kind === "pothole") s.v *= 0.75;
    else if (h.kind === "oil") { s.oil = 1.2; h.hit = false; }
    else if (s.v > WRECK) wreck(s);
    else { s.v *= 0.2; say(s, "SPIN OUT!"); }
  }

  // stops: at rest with the door in the bay window, someone gets in or out
  if (Math.abs(s.v) < 0.3 && s.boarding <= 0 && s.spin <= 0) {
    const st = s.stops.find((o) => !o.taken && s.z >= o.z && s.z <= o.z + o.len);
    if (st && s.x + CAR_W / 2 > W + 0.4) {
      if (st.drop) {
        const out = s.seats.filter((r) => r && r.dest === st.drop) as Rider[];
        if (out.length) {
          const award = out.reduce((a, r) => a + agePoints(r.age) * GROUP[out.length], 0);
          s.banked += award;
          s.delivered += out.length;
          s.seats = s.seats.map((r) => (r && r.dest === st.drop ? null : r));
          s.boarding = 1;
          say(s, out.length > 1 ? `GROUP DROP X${GROUP[out.length]} +${award}` : `+${award}`, 2);
          s.log.push({ k: "drop", t: tick(s) });
        }
      } else if (st.rider && s.seats.includes(null)) {
        st.taken = true;
        s.seats[s.seats.indexOf(null)] = st.rider;
        s.boarding = 1.2;
        if (s.hot < 2.5) say(s, "CRAZY STOP!", 2);
        s.log.push({ k: "pick", stop: st.i, t: tick(s) });
      }
    }
  }
  s.score = s.banked + Math.floor(s.dist * RATE);
}

// the stop whose face and radar the HUD shows
export function candidate(s: Sim): Stop | undefined {
  return s.stops.find((o) => !o.taken && o.z + o.len > s.z - 10 && o.z < s.z + 250);
}
