// Attract mode on the painted splash: boomers walk down the right sidewalk and board, one after another, while the
// rules run right to left in a ribbon along the bottom. Drawn over the title scene in its 1280x960 reference space.
import { CHARACTERS } from "./game/course";
import { PEOPLE, img } from "./game/art";

const IDS = Object.keys(CHARACTERS).filter((id) => CHARACTERS[id].age >= 50); // boomers only on the splash
const DOOR = [965, 850] as const, FAR = [1150, 590] as const; // where the rider ends up (ground point) and where they appear; mirrored for the left side
const PERIOD = 7; // seconds per rider
const RULES = [
  "DON'T DRINK & DRIVE", "PICK UP BOOMERS AT THE CURB", "AGES 70 TO 80 = MAX POINTS", "MILLENNIALS AND GEN Z ARE NOT WORTH IT", "READ THE BOOMER RADAR BEFORE YOU STOP",
  "YOU GOT 3-MIN TO DRIVE & PICK UP BOOMERS", "3 SEATS IN THE CAR = MAX 3 PASSENGERS", "DROP YOUR PASSENGERS WHERE THEY WANT TO GET POINTS", "DON'T CRASH! OR PASSENGERS WILL LEAVE THE CAR",
  "DRIVE MORE KMS = GET MORE POINTS",
].join("      •      ");
const RIBBON_PX_PER_S = 140;

/** The 1280x960 frame fitted in a canvas of w x h: its scale and offset. The splash box is 4:3, so this is the whole canvas;
 *  any other shape letterboxes the drawing on the contained scene rather than spilling off it */
export function frameOf(w: number, h: number) {
  const k = Math.min(w / 1280, h / 960);
  return { k, ox: (w - 1280 * k) / 2, oy: (h - 960 * k) / 2 };
}
/** Rider n at phase u of its period: ground point in the frame, scale in pixels per metre, alpha */
export function riderAt(n: number, u: number) {
  const walk = Math.min(1, u / 0.6), e = walk * walk * (3 - 2 * walk), fromLeft = n % 2 === 1;
  const gx0 = FAR[0] + (DOOR[0] - FAR[0]) * e, gx = fromLeft ? 1280 - gx0 : gx0, gy = FAR[1] + (DOOR[1] - FAR[1]) * e;
  return { gx, gy, fromLeft, ppm: 150 + 110 * e, alpha: u < 0.6 ? 1 : u < 0.75 ? 1 - (u - 0.6) / 0.15 : 0 };
}

export function startAttract(cv: HTMLCanvasElement): () => void {
  const ctx = cv.getContext("2d")!;
  let raf = 0, t0 = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dpr = Math.min(1.5, devicePixelRatio), w = cv.clientWidth * dpr, h = cv.clientHeight * dpr;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const { k, ox, oy } = frameOf(w, h), t = (now - t0) / 1000, n = Math.floor(t / PERIOD), u = (t % PERIOD) / PERIOD;
    ctx.clearRect(0, 0, w, h);
    ctx.save(); ctx.translate(ox, oy);
    // one rider per period: walks in over the first 60%, boards (fades) over the next 15%, then a pause
    const ch = CHARACTERS[IDS[(n * 7) % IDS.length]], sheet = PEOPLE[ch.atlasSet ?? "a"], im = img(sheet.file);
    const { gx, gy, fromLeft, ppm, alpha } = riderAt(n, u), hgt = 1.75 * ppm; // pixels per metre grows as they come down the sidewalk
    if (im && alpha > 0) {
      const f = hgt / 366, sx = (ch.atlasIndex % sheet.cols) * sheet.cw, sy = Math.floor(ch.atlasIndex / sheet.cols) * sheet.ch;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.translate(gx * k, gy * k);
      if (!fromLeft) ctx.scale(-1, 1); // the raised hand is on the road's side: as drawn it is the viewer's left, so the right side mirrors
      ctx.drawImage(im, sx, sy, sheet.cw, sheet.ch, -sheet.ax * f * k, -sheet.ay * f * k, sheet.cw * f * k, sheet.ch * f * k);
      ctx.restore();
    }
    // the rules ribbon, right to left, looping
    // the kit's smoked-glass strip (results kit): 64 px at 896, a hairline on top, Chakra at 17 px on a .6 h baseline
    ctx.font = `600 ${17 * k}px "Chakra Petch", sans-serif`; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    const text = `${RULES}      •      `, tw = ctx.measureText(text).width, off = (t * RIBBON_PX_PER_S * k) % tw;
    const fw = 1280 * k;
    ctx.fillStyle = "rgba(7,16,26,0.91)"; ctx.fillRect(0, 896 * k, fw, 64 * k);
    ctx.fillStyle = "#4b6970"; ctx.fillRect(12 * k, 897 * k, fw - 24 * k, 1);
    ctx.fillStyle = "#d5e3e0";
    for (let x = -off; x < fw; x += tw) ctx.fillText(text, x, (896 + 38.4) * k);
    ctx.restore();
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
