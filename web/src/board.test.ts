// The head unit and the results screen in Bread's fullscreen: inside the notch and the home bar, clear of Bread's button.
import { afterEach, describe, expect, it } from "vitest";
import { measure } from "./board";
import menu from "./game/data/menu.json";

const screen = (w: number, h: number, bread: Record<string, number> = {}) => {
  Object.defineProperty(window, "innerWidth", { value: w, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: h, configurable: true });
  for (const [k, v] of Object.entries(bread)) document.documentElement.style.setProperty(`--bread-${k}`, `${v}px`);
};
afterEach(() => document.documentElement.removeAttribute("style"));

/** The screen's box on the page */
const box = (w: number, h: number) => {
  const f = measure(menu), [cw, ch] = menu[f.layout].canvas;
  return { ...f, right: f.left + cw * f.scale, bottom: f.top + ch * f.scale, w, h };
};
const clear = (b: ReturnType<typeof box>, button: number[]) => b.right <= button[0] || b.left >= button[0] + button[2] || b.bottom <= button[1] || b.top >= button[1] + button[3];

describe("a designer screen", () => {
  it("outside Bread fills the window as before, centred", () => {
    screen(852, 393);
    const b = box(852, 393);
    expect(b.layout).toBe("landscape");
    expect(b.scale).toBeCloseTo(Math.min(852 / 740, 393 / 340));
    expect(b.left).toBeCloseTo((852 - 740 * b.scale) / 2);
    expect(b.top).toBeCloseTo((393 - 340 * b.scale) / 2);
  });

  it("sideways in Bread's fullscreen: inside the notch and the home bar, beside Bread's button (bigger than under it)", () => {
    const bread = { "safe-area-top": 24, "safe-area-left": 59, "safe-area-right": 59, "safe-area-bottom": 21, "control-left": 71, "control-top": 32, "control-width": 64, "control-height": 48, "control-inset-top": 88 };
    screen(852, 393, bread);
    const b = box(852, 393);
    expect(b.layout).toBe("landscape");
    expect(b.left).toBeGreaterThanOrEqual(59);
    expect(b.right).toBeLessThanOrEqual(852 - 59 + 0.01);
    expect(b.top).toBeGreaterThanOrEqual(24);
    expect(b.bottom).toBeLessThanOrEqual(393 - 21 + 0.01);
    expect(clear(b, [71, 32, 64, 48])).toBe(true);
    expect(b.scale).toBeCloseTo((852 - 59 - 59 - (71 + 64 + 8 - 59)) / 740);
  });

  it("upright in Bread's fullscreen: under Bread's button (bigger than beside it)", () => {
    screen(393, 852, { "safe-area-top": 59, "safe-area-bottom": 34, "control-left": 12, "control-top": 67, "control-width": 64, "control-height": 48, "control-inset-top": 123 });
    const b = box(393, 852);
    expect(b.layout).toBe("portrait");
    expect(b.top).toBeGreaterThanOrEqual(123);
    expect(b.bottom).toBeLessThanOrEqual(852 - 34 + 0.01);
    expect(clear(b, [12, 67, 64, 48])).toBe(true);
  });

  it("Bread before 1.17.4 gives only the height to keep clear: the screen starts under it", () => {
    screen(852, 393, { "control-inset-top": 88 });
    expect(box(852, 393).top).toBeGreaterThanOrEqual(88);
  });
});
