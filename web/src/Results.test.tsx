// The results well after a shot: a win offers POST IT (the rival's score becomes a record of their own), a loss does not.
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Results from "./Results";
import { newSim } from "./game/sim";
import type { ChainApi } from "./chain/ChainHost";

// jsdom has no canvas and no font set: the text baseline measure gets stand-ins
HTMLCanvasElement.prototype.getContext = (() => ({ measureText: () => ({ fontBoundingBoxAscent: 70, fontBoundingBoxDescent: 20 }) })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
Object.defineProperty(document, "fonts", { value: { check: () => false } });
const chain = { ready: true, me: { suffix: 1n, prefix: 2n }, balance: 2_000_000n, busy: null, trouble: null, local: true } as unknown as ChainApi;
const noop = () => undefined;
const page = (settled: { won: boolean; claimed: boolean; text: string } | null, posted = null) => {
  const s = newSim(7, 0); s.score = 1500;
  return renderToString(<Results s={s} station={0} chain={chain} posted={posted} setPosted={noop} shot={{ target: 829 }} settled={settled} noBread={false} onSame={noop} onNew={noop} onMenu={noop} onRetry={noop} />);
};

describe("a shot's results well", () => {
  it("offers POST IT once the win is settled, under the verdict", () => {
    const html = page({ won: true, claimed: true, text: "1,500 POINTS. YOU WIN! DONE!" });
    expect(html).toContain("RECORD BEATEN"); expect(html).toContain("YOU WIN! DONE!"); expect(html).toContain(">POST IT<"); expect(html).toContain(">NEW RUN<"); expect(html).toContain(">MENU<");
  });
  it("offers nothing to post on a loss, or before the chain has settled", () => {
    expect(page({ won: false, claimed: false, text: "NOT ENOUGH." })).not.toContain("POST IT");
    expect(page(null)).not.toContain("POST IT");
  });
});
