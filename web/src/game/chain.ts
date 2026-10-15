// What the chain sees of a run: the course packed into felts (28 streets x 8) and the decision log packed into felts.
// `masm/games/pub_score.masm` reads exactly this; `integration/src/game.rs` is the Rust side. Every value fits a u32.
import { DISTRICTS, agePoints, type Event, type Node } from "./sim";

export const NODE_FELTS = 8, SLOTS = NODE_FELTS - 1;
const district = (d: Node["district"]) => DISTRICTS.indexOf(d);

/// One felt per street header (district * 16 + stop count), then up to 7 stops as dest << 24 | points << 12 | z / 5.
export function packCourse(course: Node[][]): number[] {
  const out: number[] = [];
  for (const row of course) for (const n of row) {
    if (n.stops.length > SLOTS) throw new Error(`street has ${n.stops.length} stops, the chain holds ${SLOTS}`);
    out.push(district(n.district) * 16 + n.stops.length);
    for (let i = 0; i < SLOTS; i++) {
      const st = n.stops[i];
      out.push(st ? district(st.rider.dest) * 2 ** 24 + agePoints(st.rider.age) * 2 ** 12 + Math.round(st.z / 5) : 0);
    }
  }
  return out;
}

/// kind << 24 | arg << 16 | t: fork (side 0 left, 1 right), pick (stop index), drop, wreck.
export const packEvent = (e: Event): number =>
  (e.k === "fork" ? 0 * 2 ** 24 + (e.side < 0 ? 0 : 1) * 2 ** 16 : e.k === "pick" ? 1 * 2 ** 24 + e.stop * 2 ** 16 : e.k === "drop" ? 2 * 2 ** 24 : 3 * 2 ** 24) + e.t;

export const packLog = (log: Event[], dist: number): number[] => [log.length, Math.floor(dist), ...log.map(packEvent)];
