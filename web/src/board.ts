// A designer screen: its canvas scaled to the window, text placed by baseline in canvas pixels. Shared by the head unit
// and the results screen.
import { useEffect, useState } from "react";

export type Layout = "desktop" | "portrait" | "landscape";
export const px = (n: number) => `${n}px`;
/** Every score the player reads: US thousands separators, no padding */
export const fmt = (n: number) => n.toLocaleString("en-US");
/** localStorage behind a guard: blocked storage (private modes, "block all cookies") must not stop the game */
export const stored = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
export const store = (key: string, value: string | null) => { try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* storage blocked: the best score just does not persist */ } };

export function pickLayout(w: number, h: number): Layout {
  return h > w ? "portrait" : h < 460 ? "landscape" : "desktop";
}

/** The layout for the window, the scale that fits its canvas in it, and where the canvas sits (centred) */
export function useFit(canvas: Record<Layout, { canvas: number[] }>) {
  const [fit, setFit] = useState(() => measure(canvas));
  useEffect(() => {
    const on = () => setFit(measure(canvas));
    addEventListener("resize", on);
    // Bread sets its numbers on <html> after a turn of the phone, not always before the resize
    const bread = new MutationObserver(on);
    bread.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "data-bread-control-bounds"] });
    return () => (removeEventListener("resize", on), bread.disconnect());
  }, [canvas]);
  return fit;
}
/** Bread's fullscreen on phones runs the page under the notch and the home bar, its button top left, and says where in CSS
 *  variables on <html>; everywhere else they are unset, so 0 */
const bread = (name: string) => parseFloat(document.documentElement.style.getPropertyValue(`--bread-${name}`)) || 0;
export function measure(canvas: Record<Layout, { canvas: number[] }>) {
  const L = bread("safe-area-left"), T = bread("safe-area-top"), W = innerWidth - L - bread("safe-area-right"), H = innerHeight - T - bread("safe-area-bottom");
  const layout = pickLayout(W, H), [w, h] = canvas[layout].canvas;
  // clear of Bread's button: beside it or under it, whichever leaves the screen bigger (Bread before 1.17.4 gives only the height)
  const fit = (x: number, y: number) => {
    const scale = Math.min((W - x) / w, (H - y) / h);
    return { scale, left: L + x + (W - x - w * scale) / 2, top: T + y + (H - y - h * scale) / 2 };
  };
  const button = bread("control-width"), under = fit(0, Math.max(0, bread("control-inset-top") - T));
  const beside = button ? fit(bread("control-left") + button + 8 - L, 0) : under;
  return { layout, ...(beside.scale > under.scale ? beside : under) };
}

/** Where a font's baseline sits under the top of a line-height-1 span, in em: half-leading plus ascent. */
export const baselineEm = (() => {
  const cache = new Map<string, number>();
  return (font: string) => {
    let v = cache.get(font);
    if (v === undefined) {
      const c = document.createElement("canvas").getContext("2d")!;
      c.font = `100px "${font}"`;
      const m = c.measureText("HX0");
      v = (100 - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 200 + m.fontBoundingBoxAscent / 100;
      if (document.fonts.check(`100px "${font}"`)) cache.set(font, v);
    }
    return v;
  };
})();
