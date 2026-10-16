// Pseudo-3D view: road segments projected from a low chase camera, sprites sorted by segment and drawn at their anchors.
import { BAY, CAR_W, LANE, NAME, SEG, TOP, W, WALK, branchX, districtAt, isRed, leftEdge, rightEdge, seg, stopAt, windOf, type District, type Sim } from "./sim";
import { CHARACTERS, FORK_OUT, sidewalkX } from "./course";
import { BUILDING, DECOR, DPROP, DPROPS, DROP, FORK_STRUCT, FRONTAGE, GANTRY, ICON, MATERIALS, SHADOW, LIGHT_GREEN, LIGHT_RED, PANO, PANO_HORIZON, PEOPLE, PROP, ROAD_TINT, SHEETS, TRAFFIC, TREES, TUNNEL, VENUE_CELL, frontage, img, lit, water, type Sheet } from "./art";
import { CAR, DEFAULT_SKY, SKY, STATIONS, type TimeOfDay } from "./stations";

const N = 140; // segments drawn ahead
const TUN_H = 12, TUN_TEX = 6, TUN_IN = FORK_OUT / 2, TUN_OUT = 100; // 200 m of tunnel from the fork's mouth
const GORE = 7; // the hatched gore runs until the branches are this far apart
const FLAT = new Set<Sheet>([SHEETS.smoke, SHEETS.burst, SHEETS.oil, SHEETS.pothole]); // sprites that cast no contact shadow
const CAM_H = 2.2, CAM_BACK = 5;
export const COLOR: Record<District, string> = { downtown: "#ffe564", waterfront: "#63e7ff", casino: "#ff40bd", golf: "#78ffcb" };
const SMOKE_MS = [50, 100, 170, 260, 370, 500], SMOKE_A = [1, 1, 1, 0.85, 0.35, 0.1]; // frame ends and alphas from the metadata
const DECAL = { oil: [32, 300, 448, 160, 3.6], pothole: [32, 295, 448, 165, 3.2] } as const; // the painted ellipse in the 512 cell, the patch's width in metres
// the hour's palette (world lighting): the ground, the sidewalk and the asphalt in their two alternating slices, and the
// water's flat colour where its tile has faded out; night is the game's first palette
const GROUND: Record<TimeOfDay, [string, string]> = { night: ["#1c1636", "#1f193a"], midday: ["#66705f", "#6b7564"], sunset: ["#5a4258", "#5f465c"] };
const WALK_C: Record<TimeOfDay, [string, string]> = { night: ["#5e5280", "#665a8a"], midday: ["#aeaaa0", "#b6b2a8"], sunset: ["#a8806e", "#b08876"] };
const ASPHALT: Record<TimeOfDay, [string, string]> = { night: ["#272244", "#2c264a"], midday: ["#585862", "#5e5e68"], sunset: ["#463a54", "#4c405a"] };
const WATER_C: Record<TimeOfDay, string> = { night: "#0e1e4d", midday: "#056cb3", sunset: "#6f4465" };
const HAZE = "#3c4254"; // the rain's cloud veil over the sky

// effects live between frames: skid puffs trail behind the car, a burst marks a wreck
const puffs: { z: number; x: number; t: number }[] = [], bursts: { z: number; x: number; t: number }[] = [];
let lastT = 0, lastPuff = 0, lastSpin = 0;
let sky = DEFAULT_SKY, beat = 0, hour: TimeOfDay = "night", rain = false; // the stage's hour and weather
export const setSong = (id: string) => { const st = STATIONS.find((o) => o.id === id); sky = SKY[id] ?? DEFAULT_SKY; hour = st?.time ?? "night"; rain = !!st?.rain; heroTint = tintHero(CAR[id]); };
// the hero in the song's paint, body only: the silver body (low saturation, mid to high luminance) takes the colour with
// its own shading kept, the dark glass, tyres and grille, the red lamps and the neon reflections stay as painted
let heroTint = new Map<string, HTMLCanvasElement>();
function tintHero(color?: string): Map<string, HTMLCanvasElement> {
  const out = new Map<string, HTMLCanvasElement>();
  if (!color) return out;
  const [cr, cg, cb] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
  for (const sh of [SHEETS.hero, SHEETS.heroBrake, SHEETS.heroSpin]) {
    const im = img(sh.file);
    if (!im) continue;
    const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
    const g = c.getContext("2d")!;
    g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), q = d.data;
    for (let i = 0; i < q.length; i += 4) {
      if (q[i + 3] < 8) continue;
      const r = q[i] / 255, gg = q[i + 1] / 255, b = q[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), lum = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
      const sat = mx ? (mx - mn) / mx : 0;
      if (lum < 0.22 || sat > 0.3) continue; // dark parts and coloured parts (lamps, reflections) are not body
      const body = Math.min(1, Math.max(0, (sat < 0.15 ? 1 : (0.3 - sat) / 0.15) * (lum < 0.3 ? (lum - 0.22) / 0.08 : 1)));
      // the paint lit as the silver was, specular highlights kept white
      const shade = lum / 0.72, hi = Math.max(0, (lum - 0.9) / 0.1);
      const pr = Math.min(1, cr * shade + hi), pg = Math.min(1, cg * shade + hi), pb = Math.min(1, cb * shade + hi);
      q[i] = Math.round(255 * (r + (pr - r) * body)); q[i + 1] = Math.round(255 * (gg + (pg - gg) * body)); q[i + 2] = Math.round(255 * (b + (pb - b) * body));
    }
    g.putImageData(d, 0, 0);
    out.set(sh.file, c);
  }
  return out;
}

export const setBeat = (b: number) => { beat = b; };
// tunnel light: when we went in (the headlights come up over the next half second) and when we came out (the exit bloom)
let wasIn = false, wasNear = false, inT = -1, exitT = -1;
// masks tinted with a district colour, cached: the fork trims
const tinted = new Map<string, HTMLCanvasElement>();
// repeating patterns per image, made once; a scratch canvas darkens sprites without a canvas filter
const patterns = new Map<CanvasImageSource, CanvasPattern>();
const hazed = new Map<CanvasImageSource, HTMLCanvasElement>();
/** The band pushed into the distance: the same pixels under a veil (night: dark; day: the sky's blue) */
const haze = (im: HTMLImageElement) => {
  let c = hazed.get(im);
  if (!c) {
    c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext("2d")!;
    g.drawImage(im, 0, 0); g.globalCompositeOperation = "source-atop"; g.fillStyle = hour === "night" ? "rgba(10,10,36,0.55)" : hour === "sunset" ? "rgba(120,80,110,0.5)" : "rgba(130,150,180,0.5)"; g.fillRect(0, 0, c.width, c.height);
    hazed.set(im, c);
  }
  return c;
};
let scratch: HTMLCanvasElement | null = null;
const SHADE = (light: number) => `rgba(5,4,16,${(1 - light).toFixed(3)})`;
function tintMask(file: string, color: string, w: number, h: number): HTMLCanvasElement | undefined {
  const key = `${file}|${color}`, hit = tinted.get(key);
  if (hit) return hit;
  const im = img(file);
  if (!im) return undefined;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  g.drawImage(im, 0, 0, w, h); g.globalCompositeOperation = "source-in"; g.fillStyle = color; g.fillRect(0, 0, w, h);
  tinted.set(key, c);
  return c;
}
// blend a hex colour toward a tint
const mix = (a: string, b: string, k: number) => "#" + [0, 2, 4].map((i) => Math.round(parseInt(a.slice(1 + i, 3 + i), 16) * (1 - k) + parseInt(b.slice(1 + i, 3 + i), 16) * k).toString(16).padStart(2, "0")).join("");

export function draw(ctx: CanvasRenderingContext2D, s: Sim, w: number, h: number) {
  const cx = w / 2, hy = h * 0.42, focal = h * 0.9;
  const camZ = s.z - CAM_BACK, i0 = seg(camZ), frac = camZ / SEG - i0;
  const dxAt = (i: number) => s.dx[i] ?? 0;
  if (s.t < lastT) { puffs.length = 0; bursts.length = 0; lastSpin = 0; wasIn = wasNear = false; inT = exitT = -1; }
  lastT = s.t;
  if (s.skid && s.t - lastPuff > 0.07) { lastPuff = s.t; puffs.push({ z: s.z - 1.2, x: s.x + (puffs.length % 2 ? 0.8 : -0.8), t: s.t }); }
  if (s.spin > lastSpin) bursts.push({ z: s.z + 2.5, x: s.x, t: s.t });
  lastSpin = s.spin;

  // road centre offset and projection per segment start. OutRun's trick: the road is a parabola from the camera out,
  // the curvature accumulates into the shift, the shift into the offset, so a curve keeps bending as you drive it.
  const yAt = (i: number) => s.y[i] ?? 0;
  const roadY = (z: number) => { const j = Math.floor(z / SEG), t = z / SEG - j; return yAt(j) * (1 - t) + yAt(j + 1) * t; };
  const camY = CAM_H + roadY(camZ);
  // the near plane: the ground the bottom row of the screen looks at, 2.2 m under the camera on the flat, found on a
  // slope by a few fixed-point rounds (the camera's absolute height here pushed the plane out on every hill and left
  // the ground bare under the car). A segment start behind it is pinned to it: the nearest slice then projects true
  // instead of from a clamped distance, which blew its tile up into a blur
  let near = CAM_H * focal / (h - hy);
  for (let k = 0; k < 3; k++) near = (camY - roadY(camZ + near)) * focal / (h - hy);
  const xo: number[] = [], sy: number[] = [], sc: number[] = [], zAt: number[] = [];
  // the road's centre line as the camera sees it: curvature integrates into heading, heading into offset, exact at
  // the segment starts, and the camera's own offset and heading inside its segment taken out, so the picture is the
  // same across a segment start (the OutRun shortcut shifted the whole road by one segment's curvature there, a
  // sawtooth at speed in every curve)
  const c0 = dxAt(i0);
  for (let n = 0, x = 0, dx = 0; n <= N + 1; n++) {
    const c = dxAt(i0 + n);
    xo[n] = x - c0 * frac * (n - frac / 2);
    x += dx + c / 2;
    dx += c;
    zAt[n] = Math.max((i0 + n) * SEG, camZ + near);
    sc[n] = focal / (zAt[n] - camZ);
    sy[n] = hy + (camY - roadY(zAt[n])) * sc[n];
  }

  // the song's sky, then the district's skyline, which slides a little against the curves. The district swaps inside the tunnel
  const here = s.streets.filter((st) => s.z >= st.z0 - 50).pop() ?? s.streets[0];
  const district = here.district;
  const grad = ctx.createLinearGradient(0, 0, 0, hy);
  grad.addColorStop(0, rain ? mix(sky[0], HAZE, 0.5) : sky[0]); grad.addColorStop(1, rain ? mix(sky[1], HAZE, 0.6) : sky[1]);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, hy);
  const skyline = img(lit(PANO[district], hour));
  if (skyline) {
    const dw = w * 1.4, dh = dw / 2, dx = -xo[Math.min(N, 40)] * 0.004 * w - (dw - w) / 2;
    ctx.globalAlpha = rain ? 0.6 : 1; // the veil
    ctx.drawImage(skyline, dx, hy - dh * PANO_HORIZON, dw, dh);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = GROUND[hour][0]; ctx.fillRect(0, hy, w, h - hy);
  const [tint, tintA] = ROAD_TINT[district], asphalt = ASPHALT[hour].map((c) => mix(c, tint, tintA));

  const X = (n: number, xr: number) => cx + (xo[n] + xr - s.x) * sc[n];
  const quad = (n: number, l1: number, r1: number, l2: number, r2: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(X(n, l1), sy[n]); ctx.lineTo(X(n, r1), sy[n]);
    ctx.lineTo(X(n + 1, r2), sy[n + 1]); ctx.lineTo(X(n + 1, l2), sy[n + 1]);
    ctx.fill();
  };
  // tunnels join the areas: from where the branches run straight to the first metres of the next street. Inside it is
  // dark; the headlights come up a beat after the mouth; the wall strips glow; the exit blooms
  const tunnelAt = (z: number) => s.forks.find((o) => z >= o.zDecide + TUN_IN && z < o.zEnd + TUN_OUT);
  const inside = tunnelAt(s.z), ahead = inside ?? tunnelAt(s.z + 50); // the headlights come on 50 m before the mouth (Gaylord: lit before the car enters)
  if (ahead && !wasNear) inT = s.t;
  if (!inside && wasIn) exitT = s.t;
  wasIn = !!inside; wasNear = !!ahead;
  const hl = ahead ? Math.min(1, Math.max(0, (s.t - inT - 0.15) / 0.5)) : 0; // the headlights ramp, 0 to 1 (a step here went black then bright)
  const lightAt = (z: number) => {
    const f = tunnelAt(z);
    if (!f) return 1;
    const mouthZ = f.zDecide + TUN_IN, exitZ = f.zEnd + TUN_OUT;
    let l = 0.1 + 0.6 * Math.max(0, 1 - (z - mouthZ) / 40) + 0.6 * Math.max(0, 1 - (exitZ - z) / 22);
    l += 0.9 * hl * Math.max(0, 1 - (z - s.z) / 70);
    return Math.min(1, l);
  };
  const pattern = (im: CanvasImageSource, rep = "repeat") => { let p = patterns.get(im); if (!p) { p = ctx.createPattern(im, rep)!; patterns.set(im, p); } return p; };
  const tunnel = (n: number, c1: number, c2: number, hw: number, to: District) => {
    const z1 = (i0 + n) * SEG, light = lightAt(z1), tint = COLOR[to];
    const l1 = c1 - hw - WALK, r1 = c1 + hw + WALK, l2 = c2 - hw - WALK, r2 = c2 + hw + WALK;
    const top1 = sy[n] - TUN_H * sc[n], top2 = sy[n + 1] - TUN_H * sc[n + 1];
    const u0 = ((z1 % 8) + 8) % 8 / 8 * 1024; // the materials repeat every 8 m along the tunnel
    const poly = (pts: number[][]) => { ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
    const wall = img(TUNNEL.wall), ceiling = img(TUNNEL.ceiling);
    const shade = SHADE(light);
    const tf = tunnelAt(z1);
    if (tf && z1 < tf.zDecide + TUN_IN + SEG && z1 - camZ > 20) {
      // the mouth: the arch opening is wider than the tunnel section, so the ring between them is filled dark before the
      // walls go on (the sky and skyline showed through it); the portal's stone covers the ring's outer edge. Three
      // strips around the section (an even-odd box failed once the mouth came close and the box reached the bottom of
      // the screen); under 20 m the arch is out of view and the gap with it
      const xa = X(n, l1), xb = X(n, r1), yt = top1 - 10 * sc[n], m = 12 * sc[n];
      ctx.fillStyle = "#0b0a1a";
      ctx.fillRect(xa - m, yt, m, sy[n] + 2 - yt);
      ctx.fillRect(xb, yt, m, sy[n] + 2 - yt);
      ctx.fillRect(xa - m, yt, xb - xa + 2 * m, top1 - yt);
    }
    for (const [xa, xb] of [[X(n, l1), X(n + 1, l2)], [X(n, r1), X(n + 1, r2)]]) {
      // the textured band over the lower metres of the wall, plain dark above it, then the darkness laid over both.
      // The pattern is affine, so it is pinned along the road edge and given the segment's mean height: the seam
      // between two segments then sits in the dark top of the band instead of stepping at the road
      const ya = sy[n], yb = sy[n + 1], ta = ya - TUN_TEX * sc[n], tb = yb - TUN_TEX * sc[n + 1], hgt = TUN_TEX * (sc[n] + sc[n + 1]) / 2;
      const a = (xb - xa) / 640, b = (yb - ya) / 640;
      poly([[xa, ya], [xa, ta], [xb, tb], [xb, yb]]);
      if (wall) { const pat = pattern(wall); pat.setTransform({ a, b, c: 0, d: hgt / 1024, e: xa - u0 * a, f: ya - hgt - u0 * b }); ctx.fillStyle = pat; } else ctx.fillStyle = "#2a2a3e";
      ctx.fill();
      ctx.fillStyle = "#141028"; poly([[xa, ta], [xa, top1], [xb, top2], [xb, tb]]); ctx.fill();
      if (light < 1) { ctx.fillStyle = shade; poly([[xa, ya], [xa, top1], [xb, top2], [xb, yb]]); ctx.fill(); }
      // the light strip along the wall, one continuous band in the destination's colour that pulses with the music
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.5 + 0.5 * beat; ctx.fillStyle = tint;
      poly([[xa, ya - 2.6 * sc[n]], [xa, ya - 2.85 * sc[n]], [xb, yb - 2.85 * sc[n + 1]], [xb, yb - 2.6 * sc[n + 1]]]); ctx.fill(); ctx.restore();
    }
    // ceiling: u along the tunnel runs down the screen, v across runs along it
    const xl = X(n, l1), xr = X(n, r1);
    poly([[xl, top1], [xr, top1], [X(n + 1, r2), top2], [X(n + 1, l2), top2]]);
    if (ceiling) {
      const su = (top2 - top1) / 640, sv = (xr - xl) / ((r1 - l1) / 8 * 1024);
      const pat = pattern(ceiling); pat.setTransform({ a: 0, b: su, c: sv, d: 0, e: xl, f: top1 - u0 * su }); ctx.fillStyle = pat;
    } else ctx.fillStyle = "#1c1838";
    ctx.fill();
    if (light < 1) { ctx.fillStyle = shade; ctx.fill(); }
  };
  // the district's material over a slice, in world space: the tile repeats every `metres` along x and z, pinned to the
  // road's near edge of the segment (one affine per segment, the perspective inside a 5 m slice is small). Low contrast,
  // fading out over 70 segments so the far road stays clean
  const material = (n: number, l1: number, r1: number, l2: number, r2: number, file: string, metres: number, alpha: number) => {
    const fade = 1 - n / 70, im = img(file);
    if (fade <= 0 || !im || zAt[n + 1] <= zAt[n]) return;
    const z1 = zAt[n], rate = (sy[n] - sy[n + 1]) / (zAt[n + 1] - z1), k = sc[n] * metres / 512;
    const pat = pattern(im);
    pat.setTransform({ a: k, b: 0, c: 0, d: -rate * metres / 512, e: X(n, 0), f: sy[n] + z1 * rate });
    ctx.save(); ctx.globalAlpha = alpha * fade; ctx.fillStyle = pat;
    ctx.beginPath(); ctx.moveTo(X(n, l1), sy[n]); ctx.lineTo(X(n, r1), sy[n]); ctx.lineTo(X(n + 1, r2), sy[n + 1]); ctx.lineTo(X(n + 1, l2), sy[n + 1]); ctx.fill();
    ctx.restore();
  };
  // a road slice centred at c (relative to the main road), with its sidewalks, curbs and lane dashes
  const road = (n: number, c1: number, c2: number, hw1: number, hw2: number, re1: number, re2: number, alt: boolean, inner: -1 | 0 | 1 = 0) => {
    const z1 = (i0 + n) * SEG, lt = lightAt(z1), shade = (c: string) => (lt < 1 ? mix(c, "#050410", 1 - lt) : c);
    const mat = MATERIALS[districtAt(s, z1) ?? district];
    // a fork branch has no sidewalk on its gore side: drawn there, it lay over the other bore's lane while the two were
    // closer than its width, a lilac wedge on one side of the split (the "asymmetric fork", Gaylord's circle)
    const wl = inner < 0 ? 0 : WALK, wr = inner > 0 ? 0 : WALK;
    quad(n, c1 - hw1 - wl, c1 + re1 + wr, c2 - hw2 - wl, c2 + re2 + wr, shade(WALK_C[hour][alt ? 0 : 1]));
    if (lt === 1) { if (wl) material(n, c1 - hw1 - WALK, c1 - hw1, c2 - hw2 - WALK, c2 - hw2, mat.verge, 2.5, 0.3); if (wr) material(n, c1 + re1, c1 + re1 + WALK, c2 + re2, c2 + re2 + WALK, mat.verge, 2.5, 0.3); }
    quad(n, c1 - hw1, c1 + re1, c2 - hw2, c2 + re2, shade(alt ? asphalt[0] : asphalt[1]));
    if (lt === 1) material(n, c1 - hw1, c1 + re1, c2 - hw2, c2 + re2, mat.asphalt, 4, 0.3);
    // the curbs alternate white and pink; a fork branch's inner edge is a plain white line instead
    const curb = shade(alt ? "#e8e8f8" : "#ff6fc8"), line = shade("#e8e8f8");
    quad(n, c1 - hw1 - 0.4, c1 - hw1, c2 - hw2 - 0.4, c2 - hw2, inner < 0 ? line : curb);
    quad(n, c1 + re1, c1 + re1 + 0.4, c2 + re2, c2 + re2 + 0.4, inner > 0 ? line : curb);
    if (alt) for (const lx of [-LANE / 2, LANE / 2]) quad(n, c1 + lx - 0.08, c1 + lx + 0.08, c2 + lx - 0.08, c2 + lx + 0.08, shade("#e0e0f0"));
  };
  // the trunk widening to a fork: one plane, its two dashes running straight to the split
  const widening = (n: number, f: Sim["forks"][number], c: number, alt: boolean) => {
    const z1 = (i0 + n) * SEG, z2 = z1 + SEG, t = (z: number) => W * Math.min(1, Math.max(0, (z - f.z) / (f.zDecide - f.z)));
    road(n, c, c, W + t(z1), W + t(z2), W + t(z1), W + t(z2), alt);
  };
  // the gore at the split: plain road between the two inner edges until the branches are GORE apart, the same shade and
  // material as the lanes beside it, nothing drawn on it (a lighter wedge with hatching read as a lopsided fork; Gaylord
  // circled it: "replaced with macadam colour"). Past GORE the ground between the bores shows
  const gore = (n: number, el1: number, er1: number, el2: number, er2: number, alt: boolean) => {
    if (er1 - el1 >= GORE) return;
    const z1 = (i0 + n) * SEG, lt = lightAt(z1), mat = MATERIALS[districtAt(s, z1) ?? district];
    const c = alt ? asphalt[0] : asphalt[1];
    quad(n, el1, er1, el2, er2, lt < 1 ? mix(c, "#050410", 1 - lt) : c);
    if (lt === 1) material(n, el1, er1, el2, er2, mat.asphalt, 4, 0.3);
  };

  // sprites bucketed by segment, drawn right after their segment's ground
  const sprites = new Map<number, (() => void)[]>();
  const at = (z: number, fn: () => void) => {
    const n = seg(z) - i0;
    // nothing closer than 1.5 m to the camera: it would be hidden by the hero anyway, and a sprite that near blows up
    // to thousands of pixels, which once grew the scratch canvas past the browser's limit and blanked every dark sprite
    if (n < 0 || n > N || z < camZ + 1.5) return;
    if (!sprites.has(n)) sprites.set(n, []);
    sprites.get(n)!.push(fn);
  };
  const place = (z: number, x: number) => {
    const n = seg(z) - i0, t = z / SEG - seg(z), k = focal / Math.max(0.3, z - camZ);
    const f = s.forks.find((o) => o.side !== 0 && !o.shifted && z >= o.mouth && z < o.zEnd + FORK_OUT);
    if (f) x += branchX(f, z, f.side); // past the mouth the road is our bore, off the trunk axis until the frame shifts onto it
    const y = yAt(seg(z)) * (1 - t) + yAt(seg(z) + 1) * t;
    return { px: cx + (xo[n] + (xo[n + 1] - xo[n]) * t + x - s.x) * k, py: hy + (camY - y) * k, k };
  };
  // a whole cell of a sheet at its anchor; ppm overrides the sheet's scale, flip mirrors it for the left side
  const cell = (ctx2: CanvasRenderingContext2D, sh: Sheet, i: number, px: number, py: number, k: number, ppm = sh.ppm, flip = false, alpha = 1, light = 1) => {
    const im = heroTint.get(sh.file) ?? img(lit(sh.file, hour));
    if (!im) return;
    const f = k / ppm, sx = (i % sh.cols) * sh.cw, sy0 = Math.floor(i / sh.cols) * sh.ch, dw = sh.cw * f, dh = sh.ch * f;
    if (dw < 1 || dh < 1) return;
    ctx2.save();
    ctx2.globalAlpha = alpha;
    ctx2.translate(px, py);
    if (flip) ctx2.scale(-1, 1);
    if (light < 0.98) {
      // darkened through a scratch canvas: a canvas filter would cost more than the sprite itself
      scratch ??= document.createElement("canvas");
      const w2 = Math.ceil(dw), h2 = Math.ceil(dh);
      if (scratch.width < w2 || scratch.height < h2) { scratch.width = Math.max(scratch.width, w2); scratch.height = Math.max(scratch.height, h2); }
      const g = scratch.getContext("2d")!;
      g.clearRect(0, 0, w2, h2);
      g.drawImage(im, sx, sy0, sh.cw, sh.ch, 0, 0, dw, dh);
      g.globalCompositeOperation = "source-atop"; g.fillStyle = SHADE(light); g.fillRect(0, 0, w2, h2); g.globalCompositeOperation = "source-over";
      ctx2.drawImage(scratch, 0, 0, w2, h2, -sh.ax * f, -sh.ay * f, w2, h2);
    } else ctx2.drawImage(im, sx, sy0, sh.cw, sh.ch, -sh.ax * f, -sh.ay * f, dw, dh);
    ctx2.restore();
  };
  const shadow = img(SHADOW);
  const spr = (z: number, x: number, sh: Sheet, i: number, ppm = sh.ppm, flip = false, alpha = 1, lift = 0, light = 1, floor = 0) => at(z, () => {
    const { px, py, k } = place(z, x);
    const lt = Math.max(floor, light * lightAt(z));
    // a soft contact shadow under whatever stands on the ground, as wide as the sprite, flattened by the view
    if (shadow && !FLAT.has(sh)) { const w = sh.cw * k / ppm * 0.9, h = w * 0.16; ctx.globalAlpha = 0.45 * alpha * lt; ctx.drawImage(shadow, px - w / 2, py - h / 2, w, h); ctx.globalAlpha = 1; }
    cell(ctx, sh, i, px, py - lift * k, k, ppm, flip, alpha, lt);
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
  // the roadside frontage (world lighting): the district's 2048 x 512 band stands behind the sidewalk on both sides, tiling
  // along the road at its pixels per metre, mirrored on the left (it is painted as the right side), one affine per slice
  // like the tunnel walls. It breaks at forks and tunnels and around a venue or the destination so nothing hides an entrance
  const bare = (z: number, side: number) => s.forks.some((o) => z >= o.z - 20 && z < o.zEnd + TUN_OUT + 20) || s.stops.some((o) => (o.rider ? o.side === side && z > o.z - 10 && z < o.z + o.len + 26 : side > 0 && z > o.z - 20 && z < o.z + o.len + 30));
  const facade = (n: number, z1: number, d: District) => {
    const im = img(frontage(d, hour));
    if (!im || zAt[n + 1] <= zAt[n]) return;
    const [ppm, back] = FRONTAGE[d], per = 2048 / ppm, xw = W + BAY + WALK + back;
    // one rank of fronts: `x` metres from the axis, `grow` times the band's height, its columns shifted `shift` metres along the
    // road, with a shadow at its foot on the ground when `foot`
    const rank = (pat: CanvasPattern, x: number, grow: number, shift: number, foot: boolean) => {
      const H = 512 / ppm * grow, hN = H * sc[n], hF = H * sc[n + 1];
      const u = ((((z1 + shift) % per) + per) % per) * ppm; // the band's column at this slice
      // a slice is a trapezoid (its top converges, its bottom does not), which one affine cannot map: the band is cut into
      // horizontal strips, each pinned exactly along its bottom edge, enough of them that the top's step stays under 3 px
      // (a 26 m casino front near the camera stepped 16 px a slice and its spires broke into a trail of floating tips)
      const strips = Math.min(4, Math.max(1, Math.ceil(Math.abs(hN - hF) / 3)));
      for (const side of [1, -1] as const) {
        if (bare(z1, side)) continue;
        const xa = X(n, side * x), xb = X(n + 1, side * x), ya = sy[n], yb = sy[n + 1];
        const a = side * (xb - xa) / (SEG * ppm), u0 = side > 0 ? u : 2048 - u;
        for (let j = 0; j < strips; j++) {
          const v1 = 512 * j / strips, v2 = 512 * (j + 1) / strips, lo = 1 - v2 / 512, hi = 1 - v1 / 512;
          const bn = ya - hN * lo, bf = yb - hF * lo, b = side * (bf - bn) / (SEG * ppm), dv = (hN + hF) / 2 / 512;
          pat.setTransform({ a, b, c: 0, d: dv, e: xa - a * u0, f: bn - b * u0 - dv * v2 });
          ctx.fillStyle = pat; ctx.beginPath(); ctx.moveTo(xa, bn); ctx.lineTo(xa, ya - hN * hi); ctx.lineTo(xb, yb - hF * hi); ctx.lineTo(xb, bf); ctx.fill();
        }
        if (foot) { ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.moveTo(X(n, side * (x - 3)), ya); ctx.lineTo(xa, ya); ctx.lineTo(xb, yb); ctx.lineTo(X(n + 1, side * (x - 3)), yb); ctx.fill(); }
      }
    };
    // depth (Gaylord: "flat like paperboard buildings"): a second rank of the same fronts stands 30 m further back, taller
    // and hazed, so roofs rise behind the near rank and slide slower, and the near rank throws a shadow on the ground
    rank(pattern(haze(im), "repeat-x"), xw + 30, 1.6, per / 3, false);
    rank(pattern(im, "repeat-x"), xw, 1, 0, true);
  };
  // street furniture every 55 m, between the lamps and the frontage, on one side or the other (mirrored on the left),
  // clear of the bays and the forks
  for (let i = Math.ceil((i0 - 5) / 11) * 11 + 5; i <= i0 + N; i += 11) {
    const z = i * SEG, st = s.streets.find((o) => z >= o.z0 + 120 && z < o.z1 - 60);
    if (!st || s.forks.some((o) => z >= o.z && z < o.zEnd + FORK_OUT) || s.stops.some((o) => Math.abs(o.z + 15 - z) < 40)) continue;
    const side = (i >> 3) % 2 ? 1 : -1, d = DECOR[st.district], j = (i >> 1) % 8;
    spr(z, side > 0 ? W + BAY + WALK * 0.6 : -(W + WALK * 0.6), d.sheet, j, d.ppm[j], side < 0);
  }
  for (const c of s.traffic) {
    const yaw = c.tx - c.x < -0.3 ? 0 : c.tx - c.x > 0.3 ? 2 : 1;
    spr(c.z, c.x, TRAFFIC[c.kind], yaw + (c.braking ? 3 : 0), undefined, false, 1, 0, 1, 0.6); // its own lights keep it visible down a tunnel
  }
  // traffic lights: a head on each curb, a stop line across the road
  for (const l of s.lights) {
    at(l.z, () => {
      const { px, py, k } = place(l.z, 0);
      ctx.fillStyle = "#f0f0f0"; ctx.fillRect(px - W * k, py - 0.08 * k, 2 * W * k, 0.12 * k);
      for (const x of [-(W + 0.8), W + 0.8]) {
        const p = place(l.z, x);
        ctx.fillStyle = "#404048"; ctx.fillRect(p.px - 0.12 * k, p.py - 4 * k, 0.25 * k, 4 * k);
        cell(ctx, isRed(l, s.t) ? LIGHT_RED : LIGHT_GREEN, 0, p.px, p.py - 4 * k, k, undefined, x < 0);
      }
    });
  }
  // ground hazards are decals: the sprite's painted ellipse laid flat as a square patch of road, projected by its own
  // corners, so it foreshortens with distance like the asphalt (a billboard sat on the road like an object). Cones and
  // barriers stand up and stay sprites
  const decal = (z: number, x: number, kind: "oil" | "pothole") => at(z, () => {
    const im = img(SHEETS[kind].file), [sx, sy0, sw, sh, wm] = DECAL[kind];
    if (!im || z - wm / 2 < camZ + 1) return;
    // the patch stretches along the road with distance so it keeps a quarter of its width in height on screen: a flat
    // 3 m patch is a one-pixel line at 60 m, and a pothole has to be seen in time to dodge. It shrinks back to round as
    // you reach it, while it grows on screen, so the morph never shows
    const dm = Math.max(wm, 0.36 * (z - camZ));
    const fl = place(z + dm / 2, x - wm / 2), fr = place(z + dm / 2, x + wm / 2), nl = place(z - dm / 2, x - wm / 2);
    ctx.save(); ctx.globalAlpha = 0.3 + 0.7 * lightAt(z);
    ctx.transform((fr.px - fl.px) / sw, (fr.py - fl.py) / sw, (nl.px - fl.px) / sh, (nl.py - fl.py) / sh, fl.px, fl.py);
    ctx.drawImage(im, sx, sy0, sw, sh, 0, 0, sw, sh);
    // a second pass adds the highlights on top, so a dark pothole still reads on dark asphalt from 30 m
    ctx.globalCompositeOperation = "screen"; ctx.globalAlpha *= 0.6; ctx.drawImage(im, sx, sy0, sw, sh, 0, 0, sw, sh);
    ctx.restore();
  });
  for (const hz of s.hazards) {
    if (hz.hit) continue;
    if (hz.kind === "oil" || hz.kind === "pothole") decal(hz.z, hz.x, hz.kind); else spr(hz.z, hz.x, SHEETS[hz.kind], 0);
  }
  for (const st of s.stops) {
    const zc = st.z + st.len / 2;
    if (st.rider) {
      // a left-curb stop mirrors its venue, shelter and person
      const m = st.side, flip = m < 0;
      if (st.venue! in VENUE_CELL) spr(zc + 6, m * (W + BAY + WALK + 9), SHEETS.venues, VENUE_CELL[st.venue!], undefined, flip);
      if (!st.taken) {
        prop(st.z + 8, m * (sidewalkX + 1.5), "shelter", flip);
        const ch = CHARACTERS[st.rider.id];
        spr(zc, m * sidewalkX, PEOPLE[ch.atlasSet ?? "a"], ch.atlasIndex, undefined, flip);
      }
    } else {
      // the spending place stands behind the sidewalk: its painted front 0.8 m inside the sidewalk's far edge, so no
      // part of it reaches the bay (players braked for a casino canopy that stood in the bay); its props along the sidewalk
      const [b, ppm, edge] = BUILDING[st.drop!];
      spr(zc, W + BAY + WALK - 0.8 + (SHEETS.buildings.ax - edge) / ppm, SHEETS.buildings, b, ppm);
      DPROPS[st.drop!].forEach((p, i) => spr(st.z + [-14, 44, 88][i], W + BAY + WALK + 2.5, SHEETS.dprops, DPROP[p][0], DPROP[p][1]));
    }
    if (st.drop) {
      spr(st.z + 6, W + BAY / 2 + 0.2, DROP[st.drop], 0);
      at(zc, () => {
        const { px, py, k } = place(zc, W + BAY + 1.2);
        ctx.fillStyle = COLOR[st.drop!]; ctx.fillRect(px - 0.12 * k, py - 3 * k, 0.24 * k, 3 * k);
        const ic = img(ICON[st.drop!]);
        if (ic) ctx.drawImage(ic, px - 0.8 * k, py - 4.6 * k, 1.6 * k, 1.6 * k);
      });
    }
  }
  // the painted gantry (menu kit) 150 m before the fork: the frame spans 26 m of road, a plate per branch at its mount
  // (plate cell 1024 x 512 at 0.76, top mount 512,74), the district's trim, the name fitted to its slot, the destination
  // icon, and a badge with how many aboard want that side (hidden at zero)
  for (const f of s.forks) at(f.z - 150, () => {
    const { px, py, k } = place(f.z - 150, 0);
    const frame = img(GANTRY.frame), hangers = img(GANTRY.hangers), plate = img(GANTRY.plate), badge = img(GANTRY.badge);
    if (!frame || !plate) return;
    const g = (26 * k) / 2048, left = px - 1024 * g, top = py - 960 * g;
    ctx.drawImage(frame, left, top, 2048 * g, 1024 * g);
    if (hangers) ctx.drawImage(hangers, left, top, 2048 * g, 1024 * g);
    ctx.textBaseline = "alphabetic";
    for (const [mx, d] of [[582, f.left], [1470, f.right]] as const) {
      const ps = 0.76 * g, ox = left + (mx - 512 * 0.76) * g, oy = top + (389 - 74 * 0.76) * g;
      ctx.drawImage(plate, ox, oy, 1024 * ps, 512 * ps);
      const trim = img(GANTRY.trim[d]), ic = img(ICON[d]);
      if (trim) ctx.drawImage(trim, ox, oy, 1024 * ps, 512 * ps);
      if (ic) ctx.drawImage(ic, ox + 74 * ps, oy + 185 * ps, 130 * ps, 130 * ps);
      let fs = 93 * ps;
      if (fs >= 3) {
        ctx.font = `600 ${fs}px "Chakra Petch"`;
        const tw = ctx.measureText(NAME[d]).width;
        if (tw > 692 * ps) { fs *= (692 * ps) / tw; ctx.font = `600 ${fs}px "Chakra Petch"`; }
        ctx.fillStyle = "#fff3f4"; ctx.textAlign = "left"; ctx.fillText(NAME[d], ox + 236 * ps, oy + 277 * ps);
      }
      const n = s.seats.filter((r) => r && r.dest === d).length;
      if (n && badge) {
        const bs = 0.66 * ps, bx = ox + (864 - 128 * 0.66) * ps, by = oy + (375 - 37 * 0.66) * ps;
        ctx.drawImage(badge, bx, by, 256 * bs, 256 * bs);
        if (ic) ctx.drawImage(ic, bx + 40 * bs, by + 87 * bs, 58 * bs, 58 * bs);
        if (bs * 88 >= 3) { ctx.font = `${88 * bs}px "Share Tech Mono"`; ctx.fillStyle = "#ffe564"; ctx.textAlign = "right"; ctx.fillText(String(n), bx + 210 * bs, by + 141 * bs); }
      }
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

  // the shared fork structure's place on screen: its two mouths (664 and 1384 of the 2048 sheet) on the two branches
  const frame = (n: number, f: Sim["forks"][number]) => {
    const z = (i0 + n) * SEG, xL = X(n, branchX(f, z, -1)), xR = X(n, branchX(f, z, 1)), k = (xR - xL) / 720;
    // solid until the camera is through the plane: the arch is driven through, not faded away (a fade let the outside show)
    return { k, left: xL - 664 * k, top: sy[n] - 928 * k, a: (i0 + n) * SEG - s.z > 2 ? 1 : 0 };
  };
  // the painted openings (about 470 x 290 of the sheet) are wider and taller than the tunnel box behind them: darkness
  // fills each arch before the segments, so the box draws over it and the skyline never shows around it
  for (const f of s.forks) {
    const n = seg(f.zDecide + TUN_IN) - i0;
    if (n < 0 || n > N) continue;
    const { k, left, top, a } = frame(n, f);
    ctx.fillStyle = `rgba(10,8,24,${a.toFixed(3)})`;
    for (const mx of [664, 1384]) {
      const cxm = left + mx * k, road = top + 928 * k, r = 235 * k;
      ctx.beginPath(); ctx.moveTo(cxm - r, road); ctx.lineTo(cxm - r, road - 55 * k); ctx.arc(cxm, road - 55 * k, r, Math.PI, 0); ctx.lineTo(cxm + r, road); ctx.fill();
    }
  }
  // segments, far to near
  for (let n = N; n >= 0; n--) {
    const i = i0 + n, z1 = i * SEG, z2 = z1 + SEG, alt = (i >> 1) % 2 === 0;
    // the ground follows the hills: a full-width band per segment, so whatever stands beside the road stands on it
    const d = districtAt(s, z1) ?? district;
    if (sy[n] > sy[n + 1]) {
      const lt = lightAt(z1), g = GROUND[hour][alt ? 0 : 1];
      ctx.fillStyle = lt < 1 ? mix(g, "#050410", 1 - lt) : g;
      ctx.fillRect(0, sy[n + 1], w, sy[n] - sy[n + 1] + 0.5);
      // the waterfront's water: a plane from the promenade's back edge out to the sides, the tile in world space, its
      // flat colour beyond where the tile has faded; rain uses the night tile darkened, as the designer's note says
      if (d === "waterfront" && lt === 1) for (const side of [1, -1]) {
        const xw = side * (W + BAY + WALK + FRONTAGE.waterfront[1]), far = side * 900;
        quad(n, xw, far, xw, far, rain ? mix(WATER_C.night, "#050410", 0.4) : WATER_C[hour]);
        material(n, xw, far, xw, far, water(hour), 10, rain ? 0.5 : 0.9);
      }
    }
    // a fork is drawn the same way whatever you chose: the trunk widening to the line, then both branches at ± off
    // from the trunk axis (branchX), the gore between them, both bores until you are in yours. Once the frame has shifted
    // onto your bore (at its mouth) the slices from the mouth on are the main road again
    const f = s.forks.find((o) => z1 >= o.z && z1 < o.zEnd + FORK_OUT && !(o.shifted && z1 >= o.mouth)), past = !!f && z1 >= f.zDecide;
    const tun = tunnelAt(z1), mouth = !!tun && z1 < tun.zDecide + TUN_IN + SEG;
    if (f && past) {
      // the branch's centre at the slice's real ends: the sweep's offsets interpolated between segment starts. The nearest
      // slice is pinned to the near plane, a few metres past its segment start; the stepwise lookup put a kink in its lines
      const at = (side: -1 | 1, z: number) => { const j = (z - f.zDecide) / SEG, i = Math.max(0, Math.min(f.off.length - 1, Math.floor(j))), t = Math.max(0, Math.min(1, j - i)); return branchX(f, f.zDecide + i * SEG, side) * (1 - t) + branchX(f, f.zDecide + (i + 1) * SEG, side) * t; };
      for (const side of [-1, 1] as const) {
        const c1 = at(side, zAt[n]), c2 = at(side, zAt[n + 1]);
        road(n, c1, c2, W, W, W, W, alt, (-side) as -1 | 1);
        if (tun) tunnel(n, c1, c2, W, side < 0 ? f.left : f.right);
      }
      gore(n, at(-1, zAt[n]) + W, at(1, zAt[n]) - W, at(-1, zAt[n + 1]) + W, at(1, zAt[n + 1]) - W, alt);
    } else if (f) {
      widening(n, f, branchX(f, z1, 0), alt); // the trunk widening to the line
    } else {
      road(n, 0, 0, leftEdge(s, z1), leftEdge(s, z2), rightEdge(s, z1), rightEdge(s, z2), alt);
      if (tun) tunnel(n, 0, 0, W, tun.side < 0 ? tun.left : tun.right);
      const st = stopAt(s, z1);
      if (st && !st.taken) quad(n, st.side * (W + 0.3), st.side * (W + BAY - 0.2), st.side * (W + 0.3), st.side * (W + BAY - 0.2), st.drop ? COLOR[st.drop] + "66" : alt ? "#8a7a20" : "#a08a20");
      facade(n, z1, d);
    }
    if (f && past && mouth) {
      // one shared structure holds both mouths: scaled so its two openings sit on the two branches, fading out as we reach it
      const { k, left, top, a } = frame(n, f), name = FORK_STRUCT[here.district], body = img(lit(`fork-${name}.webp`, hour));
      if (body && a > 0) {
        ctx.save(); ctx.globalAlpha = a;
        ctx.drawImage(body, left, top, 2048 * k, 1024 * k);
        ctx.globalCompositeOperation = "lighter";
        for (const [side, to] of [["left", f.left], ["right", f.right]] as const) {
          const trim = tintMask(`fork-${name}-${side}.png`, COLOR[to], 1024, 512);
          if (trim) ctx.drawImage(trim, left, top, 2048 * k, 1024 * k);
        }
        ctx.restore();
      }
    }
    sprites.get(n)?.forEach((fn) => fn());
  }

  // rain: the wet ground throws the sky back, a sheen from the horizon down
  if (rain) {
    const sheen = ctx.createLinearGradient(0, hy, 0, h);
    sheen.addColorStop(0, "rgba(140,160,220,0.2)"); sheen.addColorStop(1, "rgba(140,160,220,0)");
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = sheen; ctx.fillRect(0, hy, w, h - hy); ctx.restore();
  }
  // headlights on the road ahead as they come up; a white bloom as we come out
  const glow = img(TUNNEL.headlight);
  if (hl > 0 && glow) {
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (const [dz, wm, al] of [[12, 9, 0.45], [26, 14, 0.3], [45, 18, 0.15]]) {
      const p = place(s.z + dz, s.x);
      ctx.globalAlpha = al * hl; ctx.drawImage(glow, p.px - wm / 2 * p.k, p.py - wm / 6 * p.k, wm * p.k, wm / 3 * p.k);
    }
    ctx.restore();
  }
  if (exitT >= 0 && s.t - exitT < 0.6) { ctx.fillStyle = `rgba(255,250,240,${(0.5 * (1 - (s.t - exitT) / 0.6)).toFixed(3)})`; ctx.fillRect(0, 0, w, h); }

  // hero car, fixed on screen: steers with its poses, brake lights with the brake, eight directions in a spin
  const k = focal / CAM_BACK, py = hy + CAM_H * k;
  const bob = Math.sin(s.dist * 0.7) * 0.025 * k * (s.v / TOP);
  if (s.spin > 0) cell(ctx, SHEETS.heroSpin, Math.floor((2.5 - s.spin) * 16) % 8, cx, py + bob, k);
  else {
    // Gaylord reads the poses the other way round when driving forward, so the flank shown is the side you steer to; reversing keeps the sheet's order
    const pose = s.v < 0 ? s.steer : -s.steer;
    cell(ctx, s.brake ? SHEETS.heroBrake : SHEETS.hero, pose < -0.3 ? 0 : pose > 0.3 ? 2 : 1, cx, py + bob, k);
  }
  if (!img(SHEETS.hero.file)) { ctx.fillStyle = "#d0d0dc"; ctx.fillRect(cx - (CAR_W / 2) * k, py - 1.1 * k, CAR_W * k, 1.1 * k); }
  // rain streaks over the whole picture, three speeds, a fixed set of threads scrolling with time and leaning with the
  // run's crosswind (the same wind that leans on the car)
  if (rain) {
    const wind = windOf(s);
    ctx.strokeStyle = "rgba(190,205,255,0.3)"; ctx.lineWidth = Math.max(1, w / 1400); ctx.beginPath();
    for (let i = 0; i < 160; i++) {
      const sp = 1 + (i % 3) * 0.3, x = (((i * 137.5 + s.t * (70 + wind * 260) * sp) % w) + w) % w, y = (((i * 71.3 + s.t * 1500 * sp) % h) + h) % h, l = (10 + (i % 4) * 4) * h / 960;
      ctx.moveTo(x, y); ctx.lineTo(x + wind * l * 0.45, y + l);
    }
    ctx.stroke();
  }
}
