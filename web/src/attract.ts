// Attract mode on the painted splash: boomers walk down the right sidewalk and board, one after another, while the
// rules run right to left in a ribbon along the bottom. Drawn over the title scene in its 1280x960 reference space.
import { CHARACTERS } from "./game/course";
import { PEOPLE, TRAFFIC, img } from "./game/art";

const IDS = Object.keys(CHARACTERS).filter((id) => CHARACTERS[id].age >= 50); // boomers only on the splash
const DOOR = [965, 850] as const, FAR = [1150, 590] as const; // where the rider ends up (ground point) and where they appear
const PERIOD = 7; // seconds per rider
const RULES = [
  "PICK UP BOOMERS AT THE CURB", "AGES 70 TO 80 = MAX POINTS!!!", "MILLENIALS AND GEN Z ARE NOT WORTH YOUR CAR", "READ THE BOOMER RADAR BEFORE YOU STOP",
  "DROP THEM WHERE THEY WANT", "YOUR CAR GOT THREE SEATS", "DON'T CRASH! BOOMERS WILL LEAVE YOUR CAR", "EACH DRIVE SESSION IS 3-MIN LONG", "DRIVE MORE = MORE POINTS",
].join("      •      ");
const RIBBON_PX_PER_S = 140;
// a car pulls away up the left lane toward the sun: the lane runs from the bottom edge to the painting's vanishing point
const LANE_NEAR = [400, 990] as const, VANISH = [640, 560] as const, CAR_PERIOD = 6, PX_PER_M_NEAR = 75;

export function startAttract(cv: HTMLCanvasElement): () => void {
  const ctx = cv.getContext("2d")!;
  let raf = 0, t0 = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dpr = Math.min(1.5, devicePixelRatio), w = cv.clientWidth * dpr, h = cv.clientHeight * dpr;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const k = w / 1280, t = (now - t0) / 1000, n = Math.floor(t / PERIOD), u = (t % PERIOD) / PERIOD;
    ctx.clearRect(0, 0, w, h);
    // the car: its apparent size falls off as 1 / distance, so it lingers near and shrinks fast toward the horizon
    const cn = Math.floor(t / CAR_PERIOD), cu = (t % CAR_PERIOD) / CAR_PERIOD, sheet0 = TRAFFIC[(cn * 5) % TRAFFIC.length], car = img(sheet0.file);
    const sc = 1 / (1 + 14 * cu); // 1 at the bottom edge, ~0.07 at the sun
    if (car && sc > 0.06) {
      const cx = VANISH[0] + (LANE_NEAR[0] - VANISH[0]) * sc, cy = VANISH[1] + (LANE_NEAR[1] - VANISH[1]) * sc;
      const f = (2 * PX_PER_M_NEAR * sc) / sheet0.ppm; // a 2 m wide car at the lane's scale, 75 px per metre at the bottom edge
      ctx.save(); ctx.globalAlpha = Math.min(1, (sc - 0.06) / 0.08);
      ctx.drawImage(car, sheet0.cw, 0, sheet0.cw, sheet0.ch, (cx - sheet0.ax * f) * k, (cy - sheet0.ay * f) * k, sheet0.cw * f * k, sheet0.ch * f * k);
      ctx.restore();
    }
    // one rider per period: walks in over the first 60%, boards (fades) over the next 15%, then a pause
    const ch = CHARACTERS[IDS[(n * 7) % IDS.length]], sheet = PEOPLE[ch.atlasSet ?? "a"], im = img(sheet.file);
    const walk = Math.min(1, u / 0.6), e = walk * walk * (3 - 2 * walk);
    const gx = FAR[0] + (DOOR[0] - FAR[0]) * e, gy = FAR[1] + (DOOR[1] - FAR[1]) * e;
    const ppm = 150 + 110 * e, hgt = 1.75 * ppm; // pixels per metre grows as they come down the sidewalk
    const alpha = u < 0.6 ? 1 : u < 0.75 ? 1 - (u - 0.6) / 0.15 : 0;
    if (im && alpha > 0) {
      const f = hgt / 366, sx = (ch.atlasIndex % sheet.cols) * sheet.cw, sy = Math.floor(ch.atlasIndex / sheet.cols) * sheet.ch;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.drawImage(im, sx, sy, sheet.cw, sheet.ch, (gx - sheet.ax * f) * k, (gy - sheet.ay * f) * k, sheet.cw * f * k, sheet.ch * f * k);
      ctx.restore();
    }
    // the rules ribbon, right to left, looping
    ctx.font = `${26 * k}px "Boomer GT", monospace`; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    const text = `${RULES}      •      `, tw = ctx.measureText(text).width, off = (t * RIBBON_PX_PER_S * k) % tw;
    ctx.fillStyle = "rgba(8,12,36,0.72)"; ctx.fillRect(0, 900 * k, w, 60 * k);
    ctx.fillStyle = "#fff3f4";
    for (let x = -off; x < w; x += tw) ctx.fillText(text, x, 930 * k);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
