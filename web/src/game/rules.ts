// The scoring rules replayed from a decision log and the course it was driven on. `masm/games/pub_score.masm` is the
// same function on the chain: a valid log is a path through the pyramid with each stop taken once, never more than 3
// aboard, drops only at a street's own bay, and every move between two placed events drivable at top speed after the
// stop's dwell (no more than 60 m backwards).
import { GROUP, RATE, RUN, TOP, agePoints, type Event, type Node, type Rider } from "./sim";
import { FORK_IN, FORK_OUT, STREET } from "./course";

const LEG_LEN = STREET + FORK_IN + FORK_OUT, DROP_Z = 130, STOP_MID = 15, PICK_TICKS = 120, DROP_TICKS = 100, REVERSE_M = 60;
const CM_PER_TICK = Math.floor(TOP); // 83: top speed in m/s is also cm per 10 ms tick

export function replay(course: Node[][], log: Event[], dist: number): { banked: number; score: number } {
  const fail = (m: string): never => { throw new Error(m); };
  const taken = new Set<string>();
  let leg = 0, k = 0, banked = 0, t = 0, seats: Rider[] = [], lastZ = -1;
  // the car reaches z at e.t: the move from the previous placed event must fit the car
  const arrive = (z: number, e: Event, dwell: number) => {
    if (lastZ >= 0) {
      if (z + REVERSE_M < lastZ) fail("too far backwards");
      if (z > lastZ && e.t - t < Math.floor((z - lastZ) * 100 / CM_PER_TICK)) fail("faster than the car");
    }
    lastZ = z; t = e.t + dwell;
  };
  for (const e of log) {
    if (e.t < t) fail("time runs backwards");
    if (e.t > RUN * 100) fail("after time up");
    const n = course[leg][k];
    if (e.k === "fork") {
      if (leg + 1 >= course.length) fail("no fork past the last leg");
      arrive(leg * LEG_LEN + STREET + FORK_IN, e, 0);
      leg++;
      k += e.side < 0 ? 0 : 1;
    } else if (e.k === "pick") {
      const st = n.stops[e.stop] ?? fail("no such stop");
      const key = `${leg}/${k}/${e.stop}`;
      if (taken.has(key)) fail("stop already taken");
      if (seats.length >= 3) fail("car full");
      arrive(leg * LEG_LEN + Math.round(st.z / 5) * 5 + STOP_MID, e, PICK_TICKS);
      taken.add(key);
      seats.push(st.rider);
    } else if (e.k === "drop") {
      if (leg === 0) fail("no drop bay on the first street");
      const out = seats.filter((r) => r.dest === n.district);
      if (!out.length) fail("nobody aboard for this bay");
      arrive(leg * LEG_LEN + DROP_Z + STOP_MID, e, DROP_TICKS);
      banked += out.reduce((a, r) => a + agePoints(r.age) * GROUP[out.length], 0);
      seats = seats.filter((r) => r.dest !== n.district);
    } else seats = []; // a wreck: the car is wherever it was, the clock keeps its last mark
  }
  if (lastZ > Math.floor(dist) + REVERSE_M) fail("the distance does not fit the run");
  return { banked, score: banked + Math.floor(dist * RATE) };
}
