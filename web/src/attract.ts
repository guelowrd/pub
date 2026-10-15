// Attract mode on the painted splash: riders walk down the right sidewalk to the car's door, board, and the callouts
// tell the loop (pull in, age reveal, points to bank). Drawn over the title scene in its 1280x960 reference space.
import { CHARACTERS } from "./game/course";
import { PEOPLE, SPLASH_CAR, img } from "./game/art";
import { agePoints } from "./game/sim";

const IDS = Object.keys(CHARACTERS).filter((id) => CHARACTERS[id].age >= 50); // the demo shows riders worth picking up
const CAR = [345, 506, 590, 393] as const; // the splash car on the title scene, as composed on board 01
const DOOR = [962, 852] as const, FAR = [1150, 600] as const; // where the rider ends up (ground point) and where they appear
const PERIOD = 7; // seconds per rider

export function startAttract(cv: HTMLCanvasElement): () => void {
  const ctx = cv.getContext("2d")!;
  let raf = 0, t0 = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dpr = Math.min(1.5, devicePixelRatio), w = cv.clientWidth * dpr, h = cv.clientHeight * dpr;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const k = w / 1280, t = (now - t0) / 1000, n = Math.floor(t / PERIOD), u = (t % PERIOD) / PERIOD;
    ctx.clearRect(0, 0, w, h);
    const car = img(SPLASH_CAR);
    if (car) ctx.drawImage(car, CAR[0] * k, CAR[1] * k, CAR[2] * k, CAR[3] * k);
    // tail lights breathe
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = 0.18 + 0.12 * Math.sin(t * 2.2);
    for (const x of [455, 825]) { const g = ctx.createRadialGradient(x * k, 712 * k, 0, x * k, 712 * k, 60 * k); g.addColorStop(0, "#ff3050"); g.addColorStop(1, "rgba(255,48,80,0)"); ctx.fillStyle = g; ctx.fillRect((x - 60) * k, 652 * k, 120 * k, 120 * k); }
    ctx.restore();
    // one rider per period: walks in over the first 60%, boards (fades) over the next 15%, then the reveal
    const ch = CHARACTERS[IDS[(n * 7) % IDS.length]], sheet = PEOPLE[ch.atlasSet ?? "a"], im = img(sheet.file);
    const walk = Math.min(1, u / 0.6), e = walk * walk * (3 - 2 * walk);
    const gx = FAR[0] + (DOOR[0] - FAR[0]) * e, gy = FAR[1] + (DOOR[1] - FAR[1]) * e;
    const ppm = 63 + 107 * e, hgt = 1.75 * ppm; // pixels per metre grows as they come down the sidewalk
    const alpha = u < 0.6 ? 1 : u < 0.75 ? 1 - (u - 0.6) / 0.15 : 0;
    if (im && alpha > 0) {
      const f = hgt / 366, sx = (ch.atlasIndex % sheet.cols) * sheet.cw, sy = Math.floor(ch.atlasIndex / sheet.cols) * sheet.ch;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.drawImage(im, sx, sy, sheet.cw, sheet.ch, (gx - sheet.ax * f) * k, (gy - sheet.ay * f) * k, sheet.cw * f * k, sheet.ch * f * k);
      ctx.restore();
    }
    // callouts: PULL IN while they walk, CRAZY STOP! as they board, then the age and the points
    const text = u < 0.55 ? "PULL IN" : u < 0.72 ? "CRAZY STOP!" : u < 0.95 ? `AGE ${ch.age}   ${agePoints(ch.age).toLocaleString("en-US")} TO BANK` : "";
    if (text) {
      ctx.font = `${34 * k}px "Boomer GT", monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = u < 0.55 ? "#ffe564" : u < 0.72 ? "#78ffcb" : "#fff3f4";
      ctx.shadowColor = "#080c24"; ctx.shadowBlur = 10 * k;
      ctx.fillText(text, 640 * k, 490 * k);
      ctx.shadowBlur = 0;
    }
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
