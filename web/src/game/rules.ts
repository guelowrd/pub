// The scoring rules replayed from a decision log and the course it was driven on. The chain script (M4) mirrors this:
// a valid log is a path through the pyramid with each stop taken once, never more than 3 aboard, drops only at a
// street's own bay. Driving time feasibility is checked there, not here.
import { GROUP, RATE, RUN, agePoints, type Event, type Node, type Rider } from "./sim";

export function replay(course: Node[][], log: Event[], dist: number): { banked: number; score: number } {
  const fail = (m: string): never => { throw new Error(m); };
  const taken = new Set<string>();
  let leg = 0, k = 0, banked = 0, t = 0, seats: Rider[] = [];
  for (const e of log) {
    if (e.t < t) fail("time runs backwards");
    if (e.t > RUN * 100) fail("after time up");
    t = e.t;
    const n = course[leg][k];
    if (e.k === "fork") {
      if (leg + 1 >= course.length) fail("no fork past the last leg");
      leg++;
      k += e.side < 0 ? 0 : 1;
    } else if (e.k === "pick") {
      const st = n.stops[e.stop] ?? fail("no such stop");
      const key = `${leg}/${k}/${e.stop}`;
      if (taken.has(key)) fail("stop already taken");
      if (seats.length >= 3) fail("car full");
      taken.add(key);
      seats.push(st.rider);
    } else if (e.k === "drop") {
      if (leg === 0) fail("no drop bay on the first street");
      const out = seats.filter((r) => r.dest === n.district);
      if (!out.length) fail("nobody aboard for this bay");
      banked += out.reduce((a, r) => a + agePoints(r.age) * GROUP[out.length], 0);
      seats = seats.filter((r) => r.dest !== n.district);
    } else seats = [];
  }
  return { banked, score: banked + Math.floor(dist * RATE) };
}
