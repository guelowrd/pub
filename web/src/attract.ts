// Attract mode on the painted splash: boomers walk down the right sidewalk and board, one after another, while the
// rules run right to left in a ribbon along the bottom. Drawn over the title scene in its 1280x960 reference space.
import { CHARACTERS } from "./game/course";
import { PEOPLE, img } from "./game/art";

const IDS = Object.keys(CHARACTERS).filter((id) => CHARACTERS[id].age >= 50); // boomers only on the splash
const DOOR = [965, 850] as const, FAR = [1150, 590] as const; // where the rider ends up (ground point) and where they appear; mirrored for the left side
const PERIOD = 7; // seconds per rider
const RULES = [
  "PICK UP BOOMERS AT THE CURB", "AGES 70 TO 80 = MAX POINTS!!!", "MILLENIALS AND GEN Z ARE NOT WORTH YOUR CAR", "READ THE BOOMER RADAR BEFORE YOU STOP",
  "DROP THEM WHERE THEY WANT", "YOUR CAR GOT THREE SEATS", "DON'T CRASH! BOOMERS WILL LEAVE YOUR CAR", "EACH DRIVE SESSION IS 3-MIN LONG", "DRIVE MORE = MORE POINTS",
].join("      •      ");
const RIBBON_PX_PER_S = 140;

export function startAttract(cv: HTMLCanvasElement): () => void {
  const ctx = cv.getContext("2d")!;
  let raf = 0, t0 = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dpr = Math.min(1.5, devicePixelRatio), w = cv.clientWidth * dpr, h = cv.clientHeight * dpr;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const k = w / 1280, t = (now - t0) / 1000, n = Math.floor(t / PERIOD), u = (t % PERIOD) / PERIOD;
    ctx.clearRect(0, 0, w, h);
    // one rider per period: walks in over the first 60%, boards (fades) over the next 15%, then a pause
    const ch = CHARACTERS[IDS[(n * 7) % IDS.length]], sheet = PEOPLE[ch.atlasSet ?? "a"], im = img(sheet.file);
    const walk = Math.min(1, u / 0.6), e = walk * walk * (3 - 2 * walk), fromLeft = n % 2 === 1;
    const gx0 = FAR[0] + (DOOR[0] - FAR[0]) * e, gx = fromLeft ? 1280 - gx0 : gx0, gy = FAR[1] + (DOOR[1] - FAR[1]) * e;
    const ppm = 150 + 110 * e, hgt = 1.75 * ppm; // pixels per metre grows as they come down the sidewalk
    const alpha = u < 0.6 ? 1 : u < 0.75 ? 1 - (u - 0.6) / 0.15 : 0;
    if (im && alpha > 0) {
      const f = hgt / 366, sx = (ch.atlasIndex % sheet.cols) * sheet.cw, sy = Math.floor(ch.atlasIndex / sheet.cols) * sheet.ch;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.translate(gx * k, gy * k);
      if (fromLeft) ctx.scale(-1, 1); // from the left they wave the other hand
      ctx.drawImage(im, sx, sy, sheet.cw, sheet.ch, -sheet.ax * f * k, -sheet.ay * f * k, sheet.cw * f * k, sheet.ch * f * k);
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
