// The run: car, road, traffic, stops, clock, score. Pure state + step(), no DOM.
// Units: metres, seconds, m/s. z runs along the road, x across it (0 = road centre, right positive).

export const KMH = 3.6;
export const TOP = 200 / KMH; // top speed
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

export interface Rider { name: string; age: number; dest: District; lo: number; hi: number }
export interface Stop { z: number; len: number; rider: Rider | null; drop: District | null; taken: boolean }
export interface Traffic { z: number; x: number; v: number; kind: number; braking: boolean }
export type HazardKind = "cone" | "oil" | "pothole" | "barrier";
export interface Hazard { z: number; x: number; kind: HazardKind; hit: boolean }
export interface Fork { z: number; zDecide: number; zEnd: number; left: District; right: District; side: -1 | 0 | 1; k: number[] }
export interface Street { z0: number; z1: number; district: District }
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
  banked: number; dist: number; score: number;
  dx: number[]; // per segment: lateral shift of the road centre (m per segment); its change is the curvature
  streets: Street[]; stops: Stop[]; hazards: Hazard[]; traffic: Traffic[]; forks: Fork[];
  callout: { text: string; t: number } | null;
  lost: Rider[]; // aboard at time-up
  log: string[]; // what happened, for tests and the decision log later
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
    seats: [null, null, null], banked: 0, dist: 0, score: 0,
    dx: [], streets: [], stops: [], hazards: [], traffic: [], forks: [],
    callout: null, lost: [], log: [],
  };
}

export const seg = (z: number) => Math.floor(z / SEG);
export const curvature = (s: Sim, z: number) => (s.dx[seg(z) + 1] ?? 0) - (s.dx[seg(z)] ?? 0);

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
  s.log.push(`wreck ${s.t.toFixed(2)}`);
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
  s.steer = dir;
  s.brake = inp.brake;
  if (s.spin > 0) {
    s.spin -= dt;
    s.v = Math.max(0, s.v - 22 * dt);
    s.x += (s.spin > 1.5 ? 1 : 0) * 3 * dt; // slides outward a little
  } else if (s.boarding > 0) {
    s.boarding -= dt;
    s.v = 0;
  } else {
    s.v += (inp.brake ? -28 : inp.gas ? 12 : -4) * dt;
    s.v = Math.min(TOP, Math.max(0, s.v));
    s.skid = inp.brake && dir !== 0 && s.v > 15;
    const lat = dir * (4 + 10 * (s.v / TOP)) * (s.skid ? 1.5 : 1) * (s.oil > 0 ? 0.4 : 1);
    s.x += lat * dt;
    if (s.oil > 0) s.x += (s.rng() - 0.5) * 12 * dt;
  }
  s.x -= curvature(s, s.z) * (s.v / TOP) ** 2 * 30 * dt;

  // curbs are walls: scrape and slow
  const r = rightEdge(s, s.z), l = -halfWidth(s, s.z);
  if (s.x + CAR_W / 2 > r) { s.x = r - CAR_W / 2; s.v *= 1 - 2 * dt; }
  if (s.x - CAR_W / 2 < l) { s.x = l + CAR_W / 2; s.v *= 1 - 2 * dt; }

  s.z += s.v * dt;
  s.dist += s.v * dt;

  // fork: crossing the decision line picks the side you're on, then you ride that branch
  for (const f of s.forks) {
    if (f.side === 0 && s.z >= f.zDecide) {
      f.side = s.x < 0 ? -1 : 1;
      s.x -= f.side * W;
      const d = seg(f.zDecide);
      f.k.forEach((k, i) => { s.dx[d + i] = f.side * k; });
      s.log.push(`fork ${f.side < 0 ? "L" : "R"} ${s.t.toFixed(2)}`);
      extend(s); // the chosen street is built now
    }
  }

  // traffic
  for (const c of s.traffic) {
    if (c.braking) c.v = Math.max(c.v - 6 * dt, 40 / KMH); else c.v = Math.min(c.v + 2 * dt, c.kind === 2 || c.kind === 5 ? 90 / KMH : 130 / KMH);
    if (s.rng() < 0.3 * dt) c.braking = !c.braking && s.rng() < 0.3;
    c.z += c.v * dt;
    if (s.bumpCd === 0 && Math.abs(c.x - s.x) < CAR_W && Math.abs(c.z - s.z) < CAR_LEN) {
      if (s.v - c.v > WRECK) wreck(s);
      else { s.v = Math.min(s.v, c.v * 0.85); s.x += (s.x < c.x ? -1 : 1) * 0.8; say(s, "BUMP"); }
      s.bumpCd = 0.6;
    }
  }
  s.traffic = s.traffic.filter((c) => c.z > s.z - 60 && c.z < s.z + 900);

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
  if (s.v < 0.3 && s.boarding <= 0 && s.spin <= 0) {
    const st = s.stops.find((o) => !o.taken && Math.abs(o.z + o.len / 2 - s.z) < 4);
    if (st && s.x + CAR_W / 2 > W + 0.4) {
      if (st.drop) {
        const out = s.seats.filter((r) => r && r.dest === st.drop) as Rider[];
        if (out.length) {
          const award = out.reduce((a, r) => a + agePoints(r.age) * GROUP[out.length], 0);
          s.banked += award;
          s.seats = s.seats.map((r) => (r && r.dest === st.drop ? null : r));
          s.boarding = 1;
          say(s, out.length > 1 ? `GROUP DROP X${GROUP[out.length]} +${award}` : `+${award}`, 2);
          s.log.push(`drop ${st.drop} ${out.length} ${s.t.toFixed(2)}`);
        }
      } else if (st.rider && s.seats.includes(null)) {
        st.taken = true;
        s.seats[s.seats.indexOf(null)] = st.rider;
        s.boarding = 1.2;
        say(s, s.hot < 2.5 ? `CRAZY STOP! AGE ${st.rider.age}` : `AGE ${st.rider.age}`, 2);
        s.log.push(`pick ${st.rider.name} ${s.t.toFixed(2)}`);
      }
    }
  }
  s.score = s.banked + Math.floor(s.dist * RATE);
}

// the stop whose face and radar the HUD shows
export function candidate(s: Sim): Stop | undefined {
  return s.stops.find((o) => !o.taken && o.z + o.len > s.z - 10 && o.z < s.z + 150);
}
