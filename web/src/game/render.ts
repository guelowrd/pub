// Pseudo-3D view: road segments projected from a low chase camera, billboards sorted by segment.
import { BAY, CAR_W, LANE, NAME, SEG, TOP, W, WALK, halfWidth, isRed, rightEdge, seg, stopAt, type District, type Sim } from "./sim";
import { FORK_OUT, sidewalkX } from "./course";

const N = 140; // segments drawn ahead
const CAM_H = 2.2, CAM_BACK = 5;
export const COLOR: Record<District, string> = { downtown: "#ffe564", waterfront: "#63e7ff", casino: "#ff40bd", golf: "#78ffcb" };
const TRAFFIC = ["#2d6b4f", "#d8d8e0", "#e8e0c8", "#c83a3a", "#3a4ae0", "#b0a890"];

export function draw(ctx: CanvasRenderingContext2D, s: Sim, w: number, h: number) {
  const cx = w / 2, hy = h * 0.42, focal = h * 0.9;
  const camZ = s.z - CAM_BACK, i0 = seg(camZ), frac = camZ / SEG - i0;
  const dxAt = (i: number) => s.dx[i] ?? 0;

  const sky = ctx.createLinearGradient(0, 0, 0, hy);
  sky.addColorStop(0, "#14102e"); sky.addColorStop(1, "#5a2a6e");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, hy);
  ctx.fillStyle = "#1a241a"; ctx.fillRect(0, hy, w, h - hy);

  // road centre offset and projection per segment start. OutRun's trick: the road is a parabola from the camera out,
  // the curvature accumulates into the shift, the shift into the offset, so a curve keeps bending as you drive it.
  const yAt = (i: number) => s.y[i] ?? 0;
  const camY = CAM_H + yAt(i0) * (1 - frac) + yAt(i0 + 1) * frac;
  const xo: number[] = [], sy: number[] = [], sc: number[] = [];
  for (let n = 0, x = 0, dx = -dxAt(i0) * frac; n <= N + 1; n++) {
    xo[n] = x;
    x += dx;
    dx += dxAt(i0 + n);
    sc[n] = focal / Math.max(0.3, (i0 + n) * SEG - camZ);
    sy[n] = hy + (camY - yAt(i0 + n)) * sc[n];
  }
  const X = (n: number, xr: number) => cx + (xo[n] + xr - s.x) * sc[n];
  const quad = (n: number, l1: number, r1: number, l2: number, r2: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(X(n, l1), sy[n]); ctx.lineTo(X(n, r1), sy[n]);
    ctx.lineTo(X(n + 1, r2), sy[n + 1]); ctx.lineTo(X(n + 1, l2), sy[n + 1]);
    ctx.fill();
  };
  // a road slice centred at c (relative to the main road), with its sidewalks, curbs and lane dashes
  const road = (n: number, c1: number, c2: number, hw1: number, hw2: number, re1: number, re2: number, alt: boolean) => {
    quad(n, c1 - hw1 - WALK, c1 + re1 + WALK, c2 - hw2 - WALK, c2 + re2 + WALK, alt ? "#6e6e78" : "#767680");
    quad(n, c1 - hw1, c1 + re1, c2 - hw2, c2 + re2, alt ? "#34343e" : "#3a3a44");
    const curb = alt ? "#d8d8d8" : "#c03030";
    quad(n, c1 - hw1 - 0.4, c1 - hw1, c2 - hw2 - 0.4, c2 - hw2, curb);
    quad(n, c1 + re1, c1 + re1 + 0.4, c2 + re2, c2 + re2 + 0.4, curb);
    if (alt) for (const lx of [-LANE / 2, LANE / 2]) quad(n, c1 + lx - 0.08, c1 + lx + 0.08, c2 + lx - 0.08, c2 + lx + 0.08, "#d0d0d8");
  };

  // sprites bucketed by segment, drawn right after their segment's ground
  const sprites = new Map<number, (() => void)[]>();
  const at = (z: number, fn: () => void) => {
    const n = seg(z) - i0;
    if (n < 0 || n > N) return;
    if (!sprites.has(n)) sprites.set(n, []);
    sprites.get(n)!.push(fn);
  };
  const place = (z: number, x: number) => {
    const n = seg(z) - i0, t = z / SEG - seg(z), k = focal / Math.max(0.3, z - camZ);
    const y = yAt(seg(z)) * (1 - t) + yAt(seg(z) + 1) * t;
    return { px: cx + (xo[n] + (xo[n + 1] - xo[n]) * t + x - s.x) * k, py: hy + (camY - y) * k, k };
  };
  const box = (z: number, x: number, bw: number, bh: number, color: string, lift = 0) => at(z, () => {
    const { px, py, k } = place(z, x);
    ctx.fillStyle = color; ctx.fillRect(px - (bw * k) / 2, py - (bh + lift) * k, bw * k, bh * k);
  });
  // lamp posts every 40 m: the eye reads speed off them
  for (let i = Math.ceil(i0 / 8) * 8; i <= i0 + N; i += 8) {
    const z = i * SEG, f = s.forks.find((o) => z >= o.z && z < o.zEnd + FORK_OUT);
    if (f) continue;
    for (const x of [-(W + WALK + 0.8), W + BAY + WALK + 0.8]) { box(z, x, 0.3, 6, "#9a9ab0"); box(z, x, 1, 0.4, "#fff0a0", 6); }
  }
  for (const c of s.traffic) {
    box(c.z, c.x, CAR_W, 1.5, TRAFFIC[c.kind]);
    box(c.z, c.x, CAR_W * 0.9, 0.18, c.braking ? "#ff3040" : "#701018", 0.35);
  }
  // traffic lights: a head on each curb, a stop line across the road
  for (const l of s.lights) {
    const lamp = isRed(l, s.t) ? "#ff2030" : "#30e060";
    box(l.z, 0, W * 2, 0.12, "#f0f0f0");
    for (const x of [-(W + 0.8), W + 0.8]) { box(l.z, x, 0.25, 4, "#404048"); box(l.z, x, 0.7, 0.7, lamp, 4); }
  }
  for (const hz of s.hazards) {
    if (hz.hit) continue;
    if (hz.kind === "cone") box(hz.z, hz.x, 0.5, 0.8, "#ff7a1a");
    else if (hz.kind === "barrier") box(hz.z, hz.x, LANE - 0.4, 1, "#e0e0e0");
    else at(hz.z, () => {
      const { px, py, k } = place(hz.z, hz.x);
      ctx.fillStyle = hz.kind === "oil" ? "#101018" : "#201810";
      ctx.beginPath(); ctx.ellipse(px, py, 1.3 * k, 0.4 * k, 0, 0, Math.PI * 2); ctx.fill();
    });
  }
  for (const st of s.stops) {
    if (st.taken) continue;
    const zc = st.z + st.len / 2;
    if (st.rider) { box(zc, sidewalkX, 0.6, 1.8, "#f0d0b0"); box(zc, sidewalkX, 0.7, 0.9, "#c04080"); }
    else box(zc, W + BAY + 1.2, 0.3, 2.6, COLOR[st.drop!]);
  }
  for (const f of s.forks) at(f.z - 150, () => {
    const { px, py, k } = place(f.z - 150, 0);
    const top = py - 6 * k, bw = (W + 3) * 2 * k;
    ctx.fillStyle = "#1c4a30"; ctx.fillRect(px - bw / 2, top, bw, 1.6 * k);
    ctx.fillStyle = "#e8e8e8"; ctx.fillRect(px - bw / 2 - 0.3 * k, top, 0.3 * k, 6 * k); ctx.fillRect(px + bw / 2, top, 0.3 * k, 6 * k);
    ctx.fillStyle = "#fff"; ctx.font = `${Math.max(6, k)}px monospace`; ctx.textBaseline = "middle";
    ctx.textAlign = "left"; ctx.fillText(`< ${NAME[f.left]}`, px - bw / 2 + 0.3 * k, top + 0.8 * k);
    ctx.textAlign = "right"; ctx.fillText(`${NAME[f.right]} >`, px + bw / 2 - 0.3 * k, top + 0.8 * k);
  });

  // segments, far to near
  for (let n = N; n >= 0; n--) {
    const i = i0 + n, z1 = i * SEG, z2 = z1 + SEG, alt = (i >> 1) % 2 === 0;
    // past a decision line the road is two branches at trunk ± off. The main road is the chosen branch (or the
    // trunk before choosing), so branch σ sits at xo + (σ - side) * off.
    const f = s.forks.find((o) => z1 >= o.zDecide && z1 < o.zEnd + FORK_OUT);
    if (f) {
      const d = i - seg(f.zDecide);
      for (const side of [-1, 1] as const) {
        if (side === f.side) continue;
        road(n, (side - f.side) * f.off[d], (side - f.side) * f.off[d + 1], W, W, W, W, alt);
      }
      if (f.side === 0) continue;
    }
    road(n, 0, 0, halfWidth(s, z1), halfWidth(s, z2), rightEdge(s, z1), rightEdge(s, z2), alt);
    const st = stopAt(s, z1);
    if (st && !st.taken) quad(n, W + 0.3, W + BAY - 0.2, W + 0.3, W + BAY - 0.2, st.drop ? COLOR[st.drop] : alt ? "#8a7a20" : "#a08a20");
    sprites.get(n)?.forEach((fn) => fn());
  }

  // hero car, fixed on screen; leans with the steer, spins on a wreck
  const k = focal / CAM_BACK, py = hy + CAM_H * k;
  const bob = Math.sin(s.dist * 0.7) * 0.025 * k * (s.v / TOP);
  ctx.save();
  ctx.translate(cx, py - 0.6 * k + bob);
  if (s.spin > 0) ctx.rotate(((2.5 - s.spin) / 2.5) * Math.PI * 4);
  else ctx.transform(1, 0, -s.steer * 0.12, 1, 0, 0);
  if (s.skid) {
    ctx.fillStyle = "rgba(220,220,240,0.35)";
    for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc((j - 1) * 0.8 * k, (0.6 + j * 0.2) * k, (0.5 + j * 0.3) * k, 0, 7); ctx.fill(); }
  }
  ctx.fillStyle = "#d0d0dc"; ctx.fillRect((-CAR_W / 2) * k, -0.5 * k, CAR_W * k, 1.1 * k);
  ctx.fillStyle = "#223"; ctx.fillRect((-CAR_W / 2 + 0.3) * k, -0.5 * k, (CAR_W - 0.6) * k, 0.4 * k);
  ctx.fillStyle = s.brake ? "#ff2040" : "#801020";
  ctx.fillRect((-CAR_W / 2 + 0.1) * k, 0.25 * k, 0.6 * k, 0.18 * k); ctx.fillRect((CAR_W / 2 - 0.7) * k, 0.25 * k, 0.6 * k, 0.18 * k);
  ctx.restore();
}
