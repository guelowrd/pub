// A designer screen: its canvas scaled to the window, text placed by baseline in canvas pixels. Shared by the head unit
// and the results screen.
import { useEffect, useState } from "react";

export type Layout = "desktop" | "portrait" | "landscape";
export const px = (n: number) => `${n}px`;

export function pickLayout(w: number, h: number): Layout {
  return h > w ? "portrait" : h < 460 ? "landscape" : "desktop";
}

/** The layout for the window and the scale that fits its canvas in it. */
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
  const layout = pickLayout(innerWidth, innerHeight), [w, h] = canvas[layout].canvas;
  return { layout, scale: Math.min(innerWidth / w, innerHeight / h) };
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
