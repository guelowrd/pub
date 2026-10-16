// The share card (ship kit template, 1200 x 630): background, chrome title, the score and the station, up to three riders,
// the frame. Saved as a PNG from the results screen.
import { CHARACTERS } from "./game/course";
import type { Rider } from "./game/sim";

const ART = `${import.meta.env.BASE_URL}art/`;
const PORTRAITS: Record<string, string> = { a: "portraits.webp", b: "portraits-b.webp", c: "portraits-c.webp" };
const SLOTS = [[666, 285, 146, 196], [829, 285, 146, 196], [992, 285, 146, 196]];
const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; });

export async function saveCard(score: number, station: string, riders: Rider[]) {
  const a = document.createElement("a");
  a.href = await renderCard(score, station, riders); a.download = `pick-up-boomers-${String(score).padStart(5, "0")}.png`; a.click();
}

/** The card as a PNG data URL. */
export async function renderCard(score: number, station: string, riders: Rider[]) {
  const [bg, title, frame] = await Promise.all([load(`${ART}share/background.png`), load(`${ART}share/title.png`), load(`${ART}share/frame.png`), document.fonts.load('148px "Share Tech Mono"'), document.fonts.load('600 42px "Chakra Petch"')]);
  const c = document.createElement("canvas"); c.width = 1200; c.height = 630;
  const g = c.getContext("2d")!;
  g.drawImage(bg, 0, 0); g.drawImage(title, 0, 0);
  // the score fits its 578 px clip, never cut; the station shrinks to 28 px, then loses its tail
  const fit = (text: string, font: (s: number) => string, size: number, min: number, width: number) => {
    for (; size > min; size -= 2) { g.font = font(size); if (g.measureText(text).width <= width) return text; }
    g.font = font(min);
    while (text.length > 1 && g.measureText(`${text}…`).width > width) text = text.slice(0, -1);
    return g.measureText(text).width <= width ? text : `${text}…`;
  };
  g.textBaseline = "alphabetic"; g.fillStyle = "#ffe16f";
  g.fillText(fit(String(score).padStart(5, "0"), (s) => `${s}px "Share Tech Mono"`, 148, 72, 578), 48, 349);
  g.fillStyle = "#fff3f4";
  g.fillText(fit(station, (s) => `600 ${s}px "Chakra Petch"`, 42, 28, 550), 48, 456);
  const atlases = await Promise.all(riders.slice(0, 3).map((r) => load(`${ART}${PORTRAITS[CHARACTERS[r.id].atlasSet ?? "a"]}`)));
  riders.slice(0, 3).forEach((r, i) => {
    const ch = CHARACTERS[r.id], im = atlases[i], cw = im.naturalWidth / 4, [x, y, w, h] = SLOTS[i], sw = cw * w / h; // cover crop
    g.drawImage(im, (ch.atlasIndex % 4) * cw + (cw - sw) / 2, Math.floor(ch.atlasIndex / 4) * cw, sw, cw, x, y, w, h);
  });
  g.drawImage(frame, 0, 0);
  return c.toDataURL("image/png");
}
