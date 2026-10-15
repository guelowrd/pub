// Pseudo-3D view: road segments projected from a low chase camera, sprites sorted by segment and drawn at their anchors.
import { BAY, CAR_W, LANE, NAME, SEG, TOP, W, WALK, halfWidth, isRed, rightEdge, seg, stopAt, type District, type Sim } from "./sim";
import { CHARACTERS, FORK_OUT, sidewalkX } from "./course";
import { BUILDING, DPROP, DPROPS, DROP, ICON, PEOPLE, PROP, SHEETS, SKYLINE, TRAFFIC, TREES, VENUE_CELL, img, type Sheet } from "./art";

const N = 140; // segments drawn ahead
const CAM_H = 2.2, CAM_BACK = 5;
export const COLOR: Record<District, string> = { downtown: "#ffe564", waterfront: "#63e7ff", casino: "#ff40bd", golf: "#78ffcb" };
const SMOKE_MS = [50, 100, 170, 260, 370, 500], SMOKE_A = [1, 1, 1, 0.85, 0.35, 0.1]; // frame ends and alphas from the metadata

// effects live between frames: skid puffs trail behind the car, a burst marks a wreck
const puffs: { z: number; x: number; t: number }[] = [], bursts: { z: number; x: number; t: number }[] = [];
let lastT = 0, lastPuff = 0, lastSpin = 0;

export function draw(ctx: CanvasRenderingContext2D, s: Sim, w: number, h: number) {
  const cx = w / 2, hy = h * 0.42, focal = h * 0.9;
  const camZ = s.z - CAM_BACK, i0 = seg(camZ), frac = camZ / SEG - i0;
  const dxAt = (i: number) => s.dx[i] ?? 0;
  if (s.t < lastT) { puffs.length = 0; bursts.length = 0; lastSpin = 0; }
  lastT = s.t;
  if (s.skid && s.t - lastPuff > 0.07) { lastPuff = s.t; puffs.push({ z: s.z - 1.2, x: s.x + (puffs.length % 2 ? 0.8 : -0.8), t: s.t }); }
  if (s.spin > lastSpin) bursts.push({ z: s.z + 2.5, x: s.x, t: s.t });
  lastSpin = s.spin;

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

  // sky and the skyline, which slides a little against the curves and barely against the hills
  const sky = ctx.createLinearGradient(0, 0, 0, hy);
  sky.addColorStop(0, "#14102e"); sky.addColorStop(1, "#5a2a6e");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, hy);
  const skyline = img(SKYLINE);
  if (skyline) {
    const dw = w * 1.4, dh = dw / 2, dx = -xo[Math.min(N, 40)] * 0.004 * w - (dw - w) / 2;
    ctx.drawImage(skyline, dx, hy - dh * 0.9, dw, dh);
  }
  ctx.fillStyle = "#1c1636"; ctx.fillRect(0, hy, w, h - hy);

  const X = (n: number, xr: number) => cx + (xo[n] + xr - s.x) * sc[n];
  const quad = (n: number, l1: number, r1: number, l2: number, r2: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(X(n, l1), sy[n]); ctx.lineTo(X(n, r1), sy[n]);
    ctx.lineTo(X(n + 1, r2), sy[n + 1]); ctx.lineTo(X(n + 1, l2), sy[n + 1]);
    ctx.fill();
  };
  // tunnels join the areas: from where the branches run straight to the first metres of the next street
  const TUN_H = 6, TUN_IN = FORK_OUT / 2, TUN_OUT = 30;
  const tunnelAt = (z: number) => s.forks.find((o) => z >= o.zDecide + TUN_IN && z < o.zEnd + TUN_OUT);
  const wallH = tunnelAt(s.z) ? 40 : TUN_H; // inside, the walls climb out of view; outside, only the portal face shows above the road
  const tunnel = (n: number, c1: number, c2: number, hw: number, tint: string, mouth: boolean) => {
    const l1 = c1 - hw - WALK, r1 = c1 + hw + WALK, l2 = c2 - hw - WALK, r2 = c2 + hw + WALK;
    const top1 = sy[n] - TUN_H * sc[n], top2 = sy[n + 1] - TUN_H * sc[n + 1], high1 = sy[n] - wallH * sc[n], high2 = sy[n + 1] - wallH * sc[n + 1];
    const poly = (pts: number[][], color: string) => { ctx.fillStyle = color; ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.fill(); };
    poly([[X(n, l1), sy[n]], [X(n, l1), high1], [X(n + 1, l2), high2], [X(n + 1, l2), sy[n + 1]]], "#141028");
    poly([[X(n, r1), sy[n]], [X(n, r1), high1], [X(n + 1, r2), high2], [X(n + 1, r2), sy[n + 1]]], "#141028");
    poly([[X(n, l1), top1], [X(n, r1), top1], [X(n + 1, r2), top2], [X(n + 1, l2), top2]], (i0 + n) % 2 ? "#1c1838" : "#201c3e");
    if ((i0 + n) % 4 === 0) poly([[X(n, c1 - 1), top1 + 0.1 * sc[n]], [X(n, c1 + 1), top1 + 0.1 * sc[n]], [X(n + 1, c2 + 1), top2 + 0.1 * sc[n + 1]], [X(n + 1, c2 - 1), top2 + 0.1 * sc[n + 1]]], tint);
    if (mouth) { // the portal face, with the opening cut out
      ctx.fillStyle = "#2a2448"; ctx.beginPath();
      ctx.rect(X(n, l1 - 4), sy[n] - (TUN_H + 4) * sc[n], X(n, r1 + 4) - X(n, l1 - 4), (TUN_H + 4) * sc[n]);
      ctx.rect(X(n, l1), top1, X(n, r1) - X(n, l1), TUN_H * sc[n]);
      ctx.fill("evenodd");
      ctx.strokeStyle = tint; ctx.lineWidth = Math.max(1, 0.25 * sc[n]); ctx.strokeRect(X(n, l1), top1, X(n, r1) - X(n, l1), TUN_H * sc[n]);
    }
  };
  // a road slice centred at c (relative to the main road), with its sidewalks, curbs and lane dashes
  const road = (n: number, c1: number, c2: number, hw1: number, hw2: number, re1: number, re2: number, alt: boolean) => {
    quad(n, c1 - hw1 - WALK, c1 + re1 + WALK, c2 - hw2 - WALK, c2 + re2 + WALK, alt ? "#5e5280" : "#665a8a");
    quad(n, c1 - hw1, c1 + re1, c2 - hw2, c2 + re2, alt ? "#272244" : "#2c264a");
    const curb = alt ? "#e8e8f8" : "#ff6fc8";
    quad(n, c1 - hw1 - 0.4, c1 - hw1, c2 - hw2 - 0.4, c2 - hw2, curb);
    quad(n, c1 + re1, c1 + re1 + 0.4, c2 + re2, c2 + re2 + 0.4, curb);
    if (alt) for (const lx of [-LANE / 2, LANE / 2]) quad(n, c1 + lx - 0.08, c1 + lx + 0.08, c2 + lx - 0.08, c2 + lx + 0.08, "#e0e0f0");
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
  // a whole cell of a sheet at its anchor; ppm overrides the sheet's scale, flip mirrors it for the left side
  const cell = (ctx2: CanvasRenderingContext2D, sh: Sheet, i: number, px: number, py: number, k: number, ppm = sh.ppm, flip = false, alpha = 1) => {
    const im = img(sh.file);
    if (!im) return;
    const f = k / ppm, sx = (i % sh.cols) * sh.cw, sy0 = Math.floor(i / sh.cols) * sh.ch;
    ctx2.save();
    ctx2.globalAlpha = alpha;
    ctx2.translate(px, py);
    if (flip) ctx2.scale(-1, 1);
    ctx2.drawImage(im, sx, sy0, sh.cw, sh.ch, -sh.ax * f, -sh.ay * f, sh.cw * f, sh.ch * f);
    ctx2.restore();
  };
  const spr = (z: number, x: number, sh: Sheet, i: number, ppm = sh.ppm, flip = false, alpha = 1) => at(z, () => {
    const { px, py, k } = place(z, x);
    cell(ctx, sh, i, px, py, k, ppm, flip, alpha);
  });
  const prop = (z: number, x: number, p: keyof typeof PROP, flip = false) => spr(z, x, SHEETS.props, PROP[p][0], PROP[p][1], flip);

  // lamp posts every 40 m, a tree between them on one side or the other; the fork zones stay bare
  for (let i = Math.ceil(i0 / 8) * 8; i <= i0 + N; i += 8) {
    const z = i * SEG, f = s.forks.find((o) => z >= o.z && z < o.zEnd + FORK_OUT);
    if (f) continue;
    prop(z, -(W + WALK + 0.8), "lamp", true); prop(z, W + BAY + WALK + 0.8, "lamp");
    const st = s.streets.find((o) => z >= o.z0 && z < o.z1);
    if (st && (i >> 3) % 2 === 0) {
      const trees = TREES[st.district], side = (i >> 4) % 2 ? 1 : -1;
      prop(z + 20, side * (W + BAY + WALK + 6), trees[(i >> 5) % 2], side < 0);
    }
  }
  for (const c of s.traffic) {
    const yaw = c.tx - c.x < -0.3 ? 0 : c.tx - c.x > 0.3 ? 2 : 1;
    spr(c.z, c.x, TRAFFIC[c.kind], yaw + (c.braking ? 3 : 0));
  }
  // traffic lights: a head on each curb, a stop line across the road
  for (const l of s.lights) {
    const lamp = isRed(l, s.t) ? "#ff2030" : "#30e060";
    at(l.z, () => {
      const { px, py, k } = place(l.z, 0);
      ctx.fillStyle = "#f0f0f0"; ctx.fillRect(px - W * k, py - 0.08 * k, 2 * W * k, 0.12 * k);
      for (const x of [-(W + 0.8), W + 0.8]) {
        const p = place(l.z, x);
        ctx.fillStyle = "#404048"; ctx.fillRect(p.px - 0.12 * k, p.py - 4 * k, 0.25 * k, 4 * k);
        ctx.fillStyle = lamp; ctx.beginPath(); ctx.arc(p.px, p.py - 4.2 * k, 0.4 * k, 0, 7); ctx.fill();
      }
    });
  }
  for (const hz of s.hazards) {
    if (hz.hit) continue;
    spr(hz.z, hz.x, SHEETS[hz.kind], 0);
  }
  for (const st of s.stops) {
    const zc = st.z + st.len / 2;
    if (st.rider) {
      if (st.venue! in VENUE_CELL) spr(zc + 6, W + BAY + WALK + 9, SHEETS.venues, VENUE_CELL[st.venue!]);
      if (!st.taken) {
        prop(st.z + 8, sidewalkX + 1.5, "shelter");
        const ch = CHARACTERS[st.rider.id];
        spr(zc, sidewalkX, PEOPLE[ch.atlasSet ?? "a"], ch.atlasIndex);
      }
    } else {
      // the spending place: its door beside the bay, its props along the sidewalk, never in the bay or the waiting patch
      const [b, ppm, door] = BUILDING[st.drop!];
      spr(zc, W + BAY + WALK + 1.5 - door, SHEETS.buildings, b, ppm);
      DPROPS[st.drop!].forEach((p, i) => spr(st.z + [-14, 44, 88][i], W + BAY + WALK + 2.5, SHEETS.dprops, DPROP[p][0], DPROP[p][1]));
    }
    if (st.drop && !st.taken) {
      spr(st.z + 6, W + BAY / 2 + 0.2, DROP[st.drop], 0);
      at(zc, () => {
        const { px, py, k } = place(zc, W + BAY + 1.2);
        ctx.fillStyle = COLOR[st.drop!]; ctx.fillRect(px - 0.12 * k, py - 3 * k, 0.24 * k, 3 * k);
        const ic = img(ICON[st.drop!]);
        if (ic) ctx.drawImage(ic, px - 0.8 * k, py - 4.6 * k, 1.6 * k, 1.6 * k);
      });
    }
  }
  for (const f of s.forks) at(f.z - 150, () => {
    const { px, py, k } = place(f.z - 150, 0);
    const top = py - 6 * k, bw = (W + 3) * 2 * k;
    ctx.fillStyle = "#1c4a30"; ctx.fillRect(px - bw / 2, top, bw, 1.8 * k);
    ctx.fillStyle = "#e8e8e8"; ctx.fillRect(px - bw / 2 - 0.3 * k, top, 0.3 * k, 6 * k); ctx.fillRect(px + bw / 2, top, 0.3 * k, 6 * k);
    ctx.font = `${Math.max(6, k)}px "PUB Pixel", monospace`; ctx.textBaseline = "middle";
    const il = img(ICON[f.left]), ir = img(ICON[f.right]);
    if (il) ctx.drawImage(il, px - bw / 2 + 0.3 * k, top + 0.2 * k, 1.4 * k, 1.4 * k);
    ctx.fillStyle = COLOR[f.left]; ctx.textAlign = "left"; ctx.fillText(`< ${NAME[f.left]}`, px - bw / 2 + 2 * k, top + 0.9 * k);
    if (ir) ctx.drawImage(ir, px + bw / 2 - 1.7 * k, top + 0.2 * k, 1.4 * k, 1.4 * k);
    ctx.fillStyle = COLOR[f.right]; ctx.textAlign = "right"; ctx.fillText(`${NAME[f.right]} >`, px + bw / 2 - 2 * k, top + 0.9 * k);
    // badge: how many aboard want that side
    for (const [side, d] of [[-1, f.left], [1, f.right]] as const) {
      const n = s.seats.filter((r) => r && r.dest === d).length;
      if (!n) continue;
      const bx = px + side * (bw / 2 - 2.2 * k), by = top + 1.8 * k;
      ctx.fillStyle = COLOR[d]; ctx.fillRect(bx - 1.2 * k, by, 2.4 * k, 1.3 * k);
      ctx.fillStyle = "#080c24"; ctx.textAlign = "center"; ctx.fillText(`x${n}`, bx, by + 0.65 * k);
    }
  });
  for (const p of puffs) {
    const ms = (s.t - p.t) * 1000, i = SMOKE_MS.findIndex((end) => ms < end);
    if (i >= 0) spr(p.z, p.x, SHEETS.smoke, i, SHEETS.smoke.ppm, false, SMOKE_A[i]);
  }
  for (const b of bursts) {
    const u = (s.t - b.t) / 0.14;
    if (u < 1) spr(b.z, b.x, SHEETS.burst, 0, SHEETS.burst.ppm / (0.85 + 0.23 * u), false, 1 - u);
  }
  while (puffs.length && s.t - puffs[0].t > 0.5) puffs.shift();
  while (bursts.length && s.t - bursts[0].t > 0.14) bursts.shift();

  // segments, far to near
  for (let n = N; n >= 0; n--) {
    const i = i0 + n, z1 = i * SEG, z2 = z1 + SEG, alt = (i >> 1) % 2 === 0;
    // past a decision line the road is two branches at trunk ± off. The main road is the chosen branch (or the
    // trunk before choosing), so branch σ sits at xo + (σ - side) * off.
    const f = s.forks.find((o) => z1 >= o.zDecide && z1 < o.zEnd + FORK_OUT);
    const tun = tunnelAt(z1), mouth = !!tun && z1 < tun.zDecide + TUN_IN + SEG;
    if (f) {
      const d = i - seg(f.zDecide);
      for (const side of [-1, 1] as const) {
        if (side === f.side) continue;
        const c1 = (side - f.side) * f.off[d], c2 = (side - f.side) * f.off[d + 1];
        road(n, c1, c2, W, W, W, W, alt);
        if (tun) tunnel(n, c1, c2, W, COLOR[side < 0 ? f.left : f.right], mouth);
      }
      if (f.side === 0) continue;
    }
    road(n, 0, 0, halfWidth(s, z1), halfWidth(s, z2), rightEdge(s, z1), rightEdge(s, z2), alt);
    if (tun) tunnel(n, 0, 0, W, COLOR[tun.side < 0 ? tun.left : tun.right], mouth);
    const st = stopAt(s, z1);
    if (st && !st.taken) quad(n, W + 0.3, W + BAY - 0.2, W + 0.3, W + BAY - 0.2, st.drop ? COLOR[st.drop] + "66" : alt ? "#8a7a20" : "#a08a20");
    sprites.get(n)?.forEach((fn) => fn());
  }

  // hero car, fixed on screen: steers with its poses, brake lights with the brake, eight directions in a spin
  const k = focal / CAM_BACK, py = hy + CAM_H * k;
  const bob = Math.sin(s.dist * 0.7) * 0.025 * k * (s.v / TOP);
  if (s.spin > 0) cell(ctx, SHEETS.heroSpin, Math.floor((2.5 - s.spin) * 16) % 8, cx, py + bob, k);
  else cell(ctx, s.brake ? SHEETS.heroBrake : SHEETS.hero, s.steer < -0.3 ? 0 : s.steer > 0.3 ? 2 : 1, cx, py + bob, k);
  if (!img(SHEETS.hero.file)) { ctx.fillStyle = "#d0d0dc"; ctx.fillRect(cx - (CAR_W / 2) * k, py - 1.1 * k, CAR_W * k, 1.1 * k); }
  map(ctx, s, w, h);
}

// course map, bottom right: the pyramid in district colours, leg 1 at the bottom, the streets driven joined, you ringed
function map(ctx: CanvasRenderingContext2D, s: Sim, w: number, h: number) {
  const rows = s.course.length;
  if (!rows) return;
  const mw = w * 0.17, mh = h * 0.2, mx = w - mw - w * 0.02, my = h - mh - h * 0.025, pad = mh * 0.12;
  const at = (leg: number, k: number) => ({ x: mx + mw / 2 + (k - leg / 2) * (mw * 0.9 / rows), y: my + mh - pad - leg * ((mh - 2 * pad) / (rows - 1)) });
  ctx.fillStyle = "rgba(11,16,45,.88)"; ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = "#63e7ff"; ctx.lineWidth = Math.max(1, w * 0.0015); ctx.strokeRect(mx, my, mw, mh);
  ctx.lineWidth = Math.max(1, w * 0.001); ctx.strokeStyle = "rgba(172,165,209,.4)";
  for (let leg = 0; leg + 1 < rows; leg++) for (let k = 0; k <= leg; k++) for (const kk of [k, k + 1]) {
    const a = at(leg, k), b = at(leg + 1, kk);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.strokeStyle = "#fff3f4"; ctx.lineWidth = Math.max(1.5, w * 0.0025);
  ctx.beginPath();
  s.streets.forEach((st, i) => { const p = at(st.leg, st.k); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
  ctx.stroke();
  const r = mw * 0.022;
  s.course.forEach((row, leg) => row.forEach((n, k) => {
    const p = at(leg, k);
    ctx.fillStyle = COLOR[n.district]; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill();
  }));
  const cur = s.streets[s.streets.length - 1], p = at(cur.leg, cur.k);
  ctx.strokeStyle = "#fff3f4"; ctx.beginPath(); ctx.arc(p.x, p.y, r * (1.8 + 0.3 * Math.sin(s.t * 6)), 0, 7); ctx.stroke();
}
