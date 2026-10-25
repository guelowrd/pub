// SAVE CARD: a phone shares the picture (its sheet has Save Image), a computer downloads it. Bread's in-app browser has no
// downloads: a download there replaced the game with the picture, and fullscreen left no way back (2026-10-25).
import { afterEach, describe, expect, it, vi } from "vitest";
import { canSaveCard, saveCard } from "./share";

const card = { url: "data:image/png;base64,AA==", name: "pick-up-boomers-4200.png", file: new File(["x"], "pick-up-boomers-4200.png", { type: "image/png" }) };
const phone = (coarse: boolean) => vi.stubGlobal("matchMedia", (q: string) => ({ matches: coarse && q === "(pointer: coarse)" }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); Object.assign(navigator, { share: undefined, canShare: undefined }); });

describe("SAVE CARD", () => {
  it("on a phone opens the share sheet with the picture, never a download", async () => {
    phone(true);
    const share = vi.fn(async () => undefined);
    Object.assign(navigator, { share, canShare: () => true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click");
    expect(canSaveCard()).toBe(true);
    await saveCard(card);
    expect(share).toHaveBeenCalledWith({ files: [card.file] });
    expect(click).not.toHaveBeenCalled();
  });

  it("a player closing the sheet is no failure", async () => {
    phone(true);
    Object.assign(navigator, { share: async () => { throw Object.assign(new Error("closed"), { name: "AbortError" }); }, canShare: () => true });
    await expect(saveCard(card)).resolves.toBeUndefined();
  });

  it("a phone that cannot share a file gets no SAVE CARD", () => {
    phone(true);
    expect(canSaveCard()).toBe(false);
  });

  it("a computer downloads the picture, as before", async () => {
    phone(false);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { expect(this.download).toBe(card.name); expect(this.href).toBe(card.url); });
    expect(canSaveCard()).toBe(true);
    await saveCard(card);
    expect(click).toHaveBeenCalledOnce();
  });
});
