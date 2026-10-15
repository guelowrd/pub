// Builds the course from the seed: an OutRun pyramid of streets (leg n has n+1 streets, from street k you fork to k or
// k+1), generated whole up front so the same seed always gives the same course, then laid on the road street by street
// as you turn into it. Riders are the designer's characters with their fixed ages, drawn at each venue by its pool weights.
import characters from "./data/characters.json";
import venuesFile from "./data/venues.json";
import { DISTRICTS, GREEN, KMH, LANE, LIGHTS, RED, SEG, W, WALK, rngFrom, seg, type District, type Hazard, type Node, type RadarClass, type Rider, type Sim } from "./sim";

export const STREET = 1200;
export const FORK_IN = 120; // the trunk widens over this before the decision line
export const FORK_OUT = 200; // the branches bend away over this after it
export const LEGS = 7; // generated depth; a good run ends around leg 5 and the clock ends it
// pickup venues per district: pairs chosen so the expected rider points per district stay close (see course.test.ts)
export const VENUES: Record<District, [string, string]> = { downtown: ["market", "garage"], waterfront: ["aquagym", "arcade"], casino: ["bar", "bingo"], golf: ["nursing-home", "school"] };
export const VENUE_OF: Record<District, string> = { downtown: "restaurant", waterfront: "cruise", casino: "casino", golf: "golf" }; // the spending place, with its own pickup pool

export const POOLS: Record<string, { character_id: string; relative_weight: number }[]> = Object.fromEntries(venuesFile.venues.map((v) => [v.id, v.candidates]));
export const CHARACTERS: Record<string, { id: string; name: string; age: number; atlasIndex: number; atlasSet?: string }> = Object.fromEntries(characters.map((c) => [c.id, c]));
const others = (d: District) => DISTRICTS.filter((o) => o !== d);
const pick = <T,>(rng: () => number, xs: T[]) => xs[Math.floor(rng() * xs.length)];

function rider(rng: () => number, venue: string, district: District): Rider {
  const pool = POOLS[venue];
  let r = rng() * pool.reduce((a, c) => a + c.relative_weight, 0), i = 0;
  while (i < pool.length - 1 && (r -= pool[i].relative_weight) >= 0) i++;
  const ch = CHARACTERS[pool[i].character_id], roll = rng();
  const cls: RadarClass = roll < 0.4 ? "TIGHT" : roll < 0.8 ? "FUZZY" : "WILD";
  const [lo, hi] = cls === "TIGHT" ? [ch.age - Math.floor(rng() * 4), ch.age + Math.floor(rng() * 4)]
    : cls === "FUZZY" ? [ch.age - 4 - Math.floor(rng() * 12), ch.age + 4 + Math.floor(rng() * 12)] : [18, 99];
  return { id: ch.id, name: ch.name, age: ch.age, dest: pick(rng, others(district)), lo: Math.max(18, lo), hi: Math.min(99, hi), cls };
}

function node(rng: () => number, district: District, leg: number): Node {
  const curves: Node["curves"] = [], hills: Node["hills"] = [];
  let z = 150;
  while (z < STREET - 300) {
    const len = 150 + rng() * 200;
    if (rng() < 0.7) curves.push([z, z + len, (rng() - 0.5) * 0.1]);
    if (rng() < 0.5) hills.push([z - 50, z + len + 50, (rng() - 0.3) * 12]);
    z += len + 60;
  }
  const n = 3 + Math.floor(rng() * 3), stops: Node["stops"] = [];
  if (leg > 0) stops.push({ z: 190, venue: VENUE_OF[district], rider: rider(rng, VENUE_OF[district], district) }); // someone leaving the spending place, after the drop bay
  let sz = 300;
  for (let i = 0; i < n; i++) {
    sz += 120 + rng() * ((STREET - 250 - sz) / (n - i) - 120);
    const venue = VENUES[district][i % 2];
    stops.push({ z: sz, venue, rider: rider(rng, venue, district) });
  }
  // hazards, clear of the stops and the fork; a barrier trails 4 cones (roadworks)
  const hazards: Hazard[] = [], lane = () => (Math.floor(rng() * 3) - 1) * LANE;
  for (let i = 0; i < 7; i++) {
    const hz = 160 + rng() * (STREET - 400);
    if (stops.some((o) => Math.abs(o.z + 15 - hz) < 60)) continue;
    const kind = pick(rng, ["cone", "cone", "oil", "pothole", "barrier"] as Hazard["kind"][]), x = lane();
    hazards.push({ z: hz, x, kind, hit: false });
    if (kind === "barrier") for (let j = 1; j <= 4; j++) hazards.push({ z: hz + 15 * j, x, kind: "cone", hit: false });
  }
  const lights: Node["lights"] = [];
  for (let i = 0; i < LIGHTS[district]; i++) {
    const lz = 200 + rng() * (STREET - 400);
    if (stops.some((o) => Math.abs(o.z + 15 - lz) < 60)) continue;
    lights.push([lz, rng() * (RED + GREEN)]);
  }
  return { district, stops, hazards, lights, curves, hills };
}

// every street differs from both parents and from its neighbour on the leg, so a fork always offers two other districts
export function pyramid(seed: number): Node[][] {
  const rng = rngFrom(seed), course: Node[][] = [];
  for (let leg = 0; leg < LEGS; leg++) {
    const row: Node[] = [];
    for (let k = 0; k <= leg; k++) {
      const used = [course[leg - 1]?.[k - 1], course[leg - 1]?.[k], row[k - 1]].map((o) => o?.district);
      row.push(node(rng, pick(rng, DISTRICTS.filter((d) => !used.includes(d))), leg));
    }
    course.push(row);
  }
  return course;
}

function setCurve(s: Sim, z0: number, z1: number, strength: number) {
  const a = seg(z0), b = seg(z1), ramp = Math.min(12, (b - a) >> 2);
  for (let i = a; i < b; i++) {
    const e = Math.min(1, (i - a) / ramp, (b - 1 - i) / ramp);
    s.dx[i] = (s.dx[i] ?? 0) + strength * e;
  }
}

function setHill(s: Sim, z0: number, z1: number, height: number) {
  const a = seg(z0), b = seg(z1);
  for (let i = a; i < b; i++) s.y[i] += (height * (1 - Math.cos((2 * Math.PI * (i - a)) / (b - a)))) / 2;
}

function place(s: Sim, leg: number, k: number, z0: number) {
  const n = s.course[leg][k], z1 = z0 + STREET;
  s.streets.push({ z0, z1, district: n.district, leg, k });
  for (let i = seg(z0); i < seg(z1 + FORK_IN + FORK_OUT); i++) { s.dx[i] = 0; s.y[i] = 0; }
  for (const [a, b, strength] of n.curves) setCurve(s, z0 + a, z0 + b, strength);
  for (const [a, b, h] of n.hills) setHill(s, z0 + a, z0 + b, h);
  if (leg > 0) s.stops.push({ z: z0 + 130, len: 30, rider: null, drop: n.district, taken: false, i: -1, venue: null }); // the tunnel runs 100 m into the street
  n.stops.forEach((o, i) => s.stops.push({ z: z0 + o.z, len: 30, rider: o.rider, drop: null, taken: false, i, venue: o.venue }));
  for (const h of n.hazards) s.hazards.push({ ...h, z: z0 + h.z });
  for (const [z, offset] of n.lights) s.lights.push({ z: z0 + z, offset });
  if (leg + 1 >= LEGS) return; // past the last street the road runs on empty
  // the branches bend away over the first half of FORK_OUT, then run straight; off[] integrates that twice
  const segs = FORK_OUT / SEG, kk: number[] = [], off = [W];
  for (let i = 0, bdx = 0; i < segs * 2; i++) {
    kk.push(i < segs / 2 ? 0.05 : 0);
    bdx += kk[i];
    off.push(off[i] + bdx);
  }
  s.forks.push({ z: z1, zDecide: z1 + FORK_IN, zEnd: z1 + FORK_IN + FORK_OUT, left: s.course[leg + 1][k].district, right: s.course[leg + 1][k + 1].district, side: 0, k: kk, off });
}

export function extend(s: Sim) {
  if (s.streets.length === 0) { s.course = pyramid(s.seed); place(s, 0, 0, 0); }
  const f = s.forks[s.forks.length - 1], last = s.streets[s.streets.length - 1];
  if (f && f.side !== 0 && s.streets.length === s.forks.length) place(s, last.leg + 1, last.k + (f.side < 0 ? 0 : 1), f.zEnd);
  // traffic: keep a few cars ahead, in lanes, slower than us
  const ahead = s.traffic.filter((c) => c.z > s.z).length;
  const want = 4 + Math.min(4, Math.floor(s.t / 30));
  if (ahead < want && s.rng() < 0.5) {
    const z = s.z + 760 + s.rng() * 400; // beyond the draw distance, so cars come into view instead of popping in
    const x = (Math.floor(s.rng() * 3) - 1) * LANE;
    const kind = Math.floor(s.rng() * 6), cruise = (kind === 2 || kind === 5 ? 70 + s.rng() * 30 : 90 + s.rng() * 50) / KMH;
    if (!s.traffic.some((c) => Math.abs(c.z - z) < 30 && c.tx === x))
      s.traffic.push({ z, x, tx: x, v: cruise, cruise, kind, braking: false });
  }
}

export const sidewalkX = W + 2.5 + WALK / 2; // where a waiting person stands, on the right
