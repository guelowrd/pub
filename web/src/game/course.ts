// Builds the road ahead from the seed: streets, their curves, stops, hazards, forks, and keeps traffic flowing.
// ponytail: a linear chain of streets for M1; the pyramid and venue pools land in M2.
import { DISTRICTS, KMH, LANE, SEG, W, WALK, seg, type District, type Hazard, type Rider, type Sim } from "./sim";

export const STREET = 1200;
export const FORK_IN = 120; // the trunk widens over this before the decision line
export const FORK_OUT = 200; // the branches bend away over this after it
const NAMES = ["LEO", "NINA", "GUS", "MILO", "JUNE", "REX", "KEN", "SOL", "BEV", "DOLLY", "OTIS", "RAY", "MEI", "AL", "IDA", "ABE"];

const pick = <T,>(rng: () => number, xs: T[]) => xs[Math.floor(rng() * xs.length)];
const others = (d: District) => DISTRICTS.filter((o) => o !== d);

function rider(rng: () => number, district: District): Rider {
  const age = 18 + Math.floor(rng() * 82);
  const cls = rng();
  const [lo, hi] = cls < 0.4 ? [age - Math.floor(rng() * 4), age + Math.floor(rng() * 4)]
    : cls < 0.8 ? [age - 4 - Math.floor(rng() * 12), age + 4 + Math.floor(rng() * 12)] : [18, 99];
  return { name: pick(rng, NAMES), age, dest: pick(rng, others(district)), lo: Math.max(18, lo), hi: Math.min(99, hi) };
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

function addStreet(s: Sim, z0: number, district: District, first: boolean) {
  const rng = s.rng, z1 = z0 + STREET;
  s.streets.push({ z0, z1, district });
  for (let i = seg(z0); i < seg(z1 + FORK_IN + FORK_OUT); i++) { s.dx[i] = 0; s.y[i] = 0; }
  // curves and hills
  let z = z0 + 150;
  while (z < z1 - 300) {
    const len = 150 + rng() * 200;
    if (rng() < 0.7) setCurve(s, z, z + len, (rng() - 0.5) * 2.4);
    if (rng() < 0.5) setHill(s, z - 50, z + len + 50, (rng() - 0.3) * 12);
    z += len + 60;
  }
  if (!first) s.stops.push({ z: z0 + 50, len: 30, rider: null, drop: district, taken: false });
  // stops
  const n = 3 + Math.floor(rng() * 3);
  let sz = z0 + 220;
  for (let i = 0; i < n; i++) {
    sz += 120 + rng() * ((z1 - 250 - sz) / (n - i) - 120);
    s.stops.push({ z: sz, len: 30, rider: rider(rng, district), drop: null, taken: false });
  }
  // hazards, clear of stops and the fork
  const lane = () => (Math.floor(rng() * 3) - 1) * LANE;
  for (let i = 0; i < 7; i++) {
    const hz = z0 + 120 + rng() * (STREET - 350);
    if (s.stops.some((o) => Math.abs(o.z + 15 - hz) < 60)) continue;
    const kind = pick(rng, ["cone", "cone", "oil", "pothole", "barrier"] as Hazard["kind"][]);
    const x = lane();
    s.hazards.push({ z: hz, x, kind, hit: false });
    if (kind === "barrier") for (let j = 1; j <= 4; j++) s.hazards.push({ z: hz + 15 * j, x, kind: "cone", hit: false });
  }
  // fork
  const [left, right] = others(district).sort(() => rng() - 0.5);
  const k: number[] = [];
  const segs = FORK_OUT / SEG;
  for (let i = 0; i < segs; i++) k.push(1.0 * Math.min(1, i / 8, (segs - 1 - i) / 12));
  s.forks.push({ z: z1, zDecide: z1 + FORK_IN, zEnd: z1 + FORK_IN + FORK_OUT, left, right, side: 0, k });
}

export function extend(s: Sim) {
  if (s.streets.length === 0) addStreet(s, 0, pick(s.rng, DISTRICTS), true);
  const f = s.forks[s.forks.length - 1];
  if (f.side !== 0 && s.streets.length === s.forks.length) addStreet(s, f.zEnd, f.side < 0 ? f.left : f.right, false);
  // traffic: keep a few cars ahead, in lanes, slower than us
  const ahead = s.traffic.filter((c) => c.z > s.z).length;
  const want = 3 + Math.min(4, Math.floor(s.t / 40));
  if (ahead < want && s.rng() < 0.5) {
    const z = s.z + 300 + s.rng() * 500;
    const x = (Math.floor(s.rng() * 3) - 1) * LANE;
    if (!s.traffic.some((c) => Math.abs(c.z - z) < 30 && c.x === x))
      s.traffic.push({ z, x, v: (70 + s.rng() * 50) / KMH, kind: Math.floor(s.rng() * 6), braking: false });
  }
}

export const sidewalkX = W + 2.5 + WALK / 2; // where a waiting person stands, on the right
