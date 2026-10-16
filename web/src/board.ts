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
    return () => removeEventListener("resize", on);
  }, [canvas]);
  return fit;
}
function measure(canvas: Record<Layout, { canvas: number[] }>) {
  const layout = pickLayout(innerWidth, innerHeight), [w, h] = canvas[layout].canvas, scale = Math.min(innerWidth / w, innerHeight / h);
  return { layout, scale, left: (innerWidth - w * scale) / 2, top: (innerHeight - h * scale) / 2 };
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
