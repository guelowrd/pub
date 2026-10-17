// Past games and boards are read from the chain alone: one test per rule (copied from GeoQuizz, maps and v1 left out).
import { describe, expect, it } from "vitest";
import { GC_FAUCET } from "../config";
import type { ChallengeNote } from "../chain";
import type { AccountFelts, ChallengeStorage } from "../notes";
import { boards, history, keyOf, lettersBackward, nicknames, owed, playersInOrder, recordOutcome, shotOutcome, triesLost } from "../hub";

const ME = { suffix: 1n, prefix: 1n };
const KQX = { suffix: 2n, prefix: 2n };
const MUD = { suffix: 3n, prefix: 3n };
const GC = 1_000_000n;
const name = (a: AccountFelts) => ({ [keyOf(ME)]: "JHT", [keyOf(KQX)]: "KQX", [keyOf(MUD)]: "MUD" })[keyOf(a)] ?? "???";

let n = 0;
const base: ChallengeStorage = { expiryBlock: 1000, target: 4100, minStake: GC, champion: ME, rival: null, recordId: [0n, 0n, 0n, 0n], shotRoot: [0n, 0n, 0n, 0n], game: [], shotDeadline: 0 };
function record(champion: AccountFelts, target: number, o: Partial<ChallengeNote> & { expiry?: number } = {}): ChallengeNote {
  const w = BigInt(++n);
  return { id: `0xr${n}`, idWord: [w, w, w, w], kind: "record", storage: { ...base, champion, target, expiryBlock: o.expiry ?? 1000 }, faucet: GC_FAUCET, amount: GC, consumed: o.consumedAt !== undefined, createdAt: n, ...o };
}
function shot(at: ChallengeNote, rival: AccountFelts, deadline: number, o: Partial<ChallengeNote> = {}): ChallengeNote {
  return { id: `0xs${++n}`, idWord: [0n, 0n, 0n, BigInt(n)], kind: "shot", storage: { ...at.storage, rival, recordId: at.idWord, shotDeadline: deadline }, faucet: GC_FAUCET, amount: GC, consumed: o.consumedAt !== undefined, createdAt: n, ...o };
}

describe("shots belong to a record by its terms", () => {
  it("a shot with other terms than its record (forged storage) counts for nothing", () => {
    const r = record(ME, 4100);
    const forged = shot(r, KQX, 900, { consumedAt: 950 });
    forged.storage = { ...forged.storage, target: 1 };
    expect(triesLost(r, [r, forged], 1000)).toBe(0);
    expect(boards([r, forged], 1000, null).defended.top).toEqual([]);
  });
});

describe("nicknames", () => {
  it("reads three letters backward from the address, digits and the wallet's routing part left out", () => {
    expect(lettersBackward("mtst1aryq2znjyt4wqq29lxwta3sjnqlnthj9_qr7qqq9wr6w").slice(0, 3)).toBe("JHT");
  });

  it("on a clash the first to play keeps the name; the next takes the next letter further back", () => {
    const names = nicknames([{ key: "first", address: "mtst1aaanthj9" }, { key: "second", address: "mtst1bbbnthj9" }, { key: "third", address: "mtst1cccnthj9" }]);
    expect([names.get("first"), names.get("second"), names.get("third")]).toEqual(["JHT", "JHN", "JHC"]);
  });

  it("orders players by their first record or shot on chain", () => {
    const r = record(MUD, 100, { createdAt: 50 });
    const s = shot(r, KQX, 900, { createdAt: 10 });
    expect(playersInOrder([r, s, record(KQX, 100, { createdAt: 60 })])).toEqual([KQX, MUD]);
  });
});

describe("how games ended", () => {
  it("a shot used up to CLAIM_FUZZ blocks past its deadline was won (the champion cannot collect before), later it was taken; unused past it is lost", () => {
    const r = record(MUD, 100);
    expect(shotOutcome(shot(r, ME, 200, { consumedAt: 199 }), 500)).toBe("won");
    expect(shotOutcome(shot(r, ME, 200, { consumedAt: 264 }), 500)).toBe("won");
    expect(shotOutcome(shot(r, ME, 200, { consumedAt: 265 }), 500)).toBe("lost");
    expect(shotOutcome(shot(r, ME, 200), 200)).toBe("lost");
    expect(shotOutcome(shot(r, ME, 200), 199)).toBe("open");
    expect(shotOutcome({ ...shot(r, ME, 200), consumed: true }, 500)).toBeUndefined();
  });

  it("a record used up to CLAIM_FUZZ blocks past its expiry was smashed, later it was taken back", () => {
    expect(recordOutcome(record(MUD, 100, { consumedAt: 1064 }), 2000)).toBe("smashed");
    expect(recordOutcome(record(MUD, 100, { consumedAt: 1065 }), 2000)).toBe("closed");
    expect(recordOutcome(record(MUD, 100), 999)).toBe("open");
    expect(recordOutcome(record(MUD, 100), 1000)).toBe("closed");
  });

  it("counts tries lost only once every shot is known", () => {
    const r = record(ME, 100);
    const notes = [r, shot(r, KQX, 200), shot(r, MUD, 900)];
    expect(triesLost(r, notes, 300)).toBe(1);
    expect(triesLost(r, [...notes, { ...shot(r, KQX, 200), consumed: true }], 300)).toBeNull();
  });

  it("what the champion can take: expired records and lost shots at them, CLAIM_FUZZ blocks past the deadline, never a shot at my own record", () => {
    const r = record(ME, 100, { expiry: 1000 });
    const lost = shot(r, KQX, 200);
    const own = shot(r, ME, 200);
    expect(owed([r, lost, own], 263, ME)).toEqual([]);
    expect(owed([r, lost, own], 264, ME).map((x) => x.id)).toEqual([lost.id]);
    expect(owed([r, lost, own], 1064, ME).map((x) => x.id)).toEqual([r.id, lost.id]);
    expect(owed([r, lost], 1064, KQX)).toEqual([]);
    expect(owed([r, lost], 1064, null)).toEqual([]);
  });
});

describe("history", () => {
  it("tells each ending in a line or two, newest first, and leaves live games out", () => {
    const smashed = record(ME, 4100, { consumedAt: 300 });
    const defended = record(ME, 6800, { consumedAt: 1200 });
    const nobody = record(ME, 3900, { consumedAt: 1100 });
    const live = record(ME, 5000);
    const theirs = record(MUD, 6200, { consumedAt: 400 });
    const other = record(KQX, 5500, { consumedAt: 50 });
    const notes = [
      smashed, shot(smashed, MUD, 200), shot(smashed, KQX, 400, { consumedAt: 300 }),
      defended, shot(defended, KQX, 200, { consumedAt: 1150 }), shot(defended, MUD, 300),
      nobody, live,
      theirs, shot(theirs, ME, 450, { consumedAt: 400 }),
      other, shot(other, ME, 600, { consumedAt: 500 }),
      shot(record(MUD, 8400), ME, 100, { consumedAt: 700 }),
    ];
    const rows = history(notes, ME, 2000, name).map((h) => [h.result, h.context, h.score, h.detail, h.money, h.note, h.tone, h.moneyTone]);
    expect(rows).toEqual([
      ["Defended", "", 6800, "2 tries lost", "1 GC won", "Your Gamecoin back.", "mint", "mint"],
      ["Taken back", "", 3900, "Nobody tried.", "1 GC back", "", "", ""],
      ["You lost", "MUD's record: ", 8400, "", "1 GC lost", "Went to MUD.", "pink", "pink"],
      ["You won", "KQX's record: ", 5500, "Prize already taken.", "1 GC back", "", "mint", ""],
      ["You won", "MUD's record: ", 6200, "", "1 GC won", "Your Gamecoin back.", "mint", "mint"],
      ["Beaten", "KQX beat ", 4100, "1 try lost", "1 GC lost", "Prize went to KQX.", "pink", "pink"],
    ]);
  });

  it("a lost shot the champion has not taken yet is history already, at its deadline; one at my own record stays locked", () => {
    const theirs = record(MUD, 6200);
    const mine = record(ME, 4100);
    const notes = [theirs, shot(theirs, ME, 450), shot(theirs, ME, 900), mine, shot(mine, ME, 300)];
    const rows = history(notes, ME, 600, name).map((h) => [h.result, h.at, h.money, h.note]);
    expect(rows).toEqual([
      ["You lost", 450, "1 GC lost", "MUD can take the coin."],
      ["You lost", 300, "1 GC lost", "Locked: this shot was at your own record."],
    ]);
  });

  it("a beaten record still counts what its champion collected from earlier losers; a defended one with nothing collected yet only has its Gamecoin back", () => {
    const beaten = record(ME, 4100, { consumedAt: 300 });
    const defended = record(ME, 6800, { consumedAt: 1200 });
    const notes = [beaten, shot(beaten, MUD, 200, { consumedAt: 280 }), shot(beaten, KQX, 400, { consumedAt: 300 }), defended, shot(defended, MUD, 300)];
    const rows = history(notes, ME, 2000, name).map((h) => [h.result, h.detail, h.money, h.note]);
    expect(rows).toEqual([
      ["Defended", "1 try lost", "1 GC back", ""],
      ["Beaten", "1 try lost", "1 GC won, 1 GC lost", "Prize went to KQX."],
    ]);
  });
});

describe("boards", () => {
  it("Gamecoins won: lost shots a champion took plus prizes, never a winner's own Gamecoin back", () => {
    const mine = record(ME, 100, { consumedAt: 2000 });
    const theirs = record(MUD, 100, { consumedAt: 150 });
    const notes = [mine, shot(mine, KQX, 200, { consumedAt: 1500 }), shot(mine, MUD, 300, { consumedAt: 1600 }), theirs, shot(theirs, KQX, 200, { consumedAt: 150 })];
    const { coins, smashed, defended } = boards(notes, 3000, ME);
    expect(coins.top.map((r) => [name(r.who), r.value])).toEqual([["JHT", 2], ["KQX", 1]]);
    expect(smashed.top.map((r) => [name(r.who), r.value])).toEqual([["KQX", 1]]);
    expect(defended.top.map((r) => [name(r.who), r.value])).toEqual([["JHT", 2]]);
  });

  it("defended counts every rival who lost, on records still open too; best records lists every record by score with my row when I am off the top", () => {
    const open = record(ME, 5382, { expiry: 5000 });
    const notes = [open, shot(open, KQX, 200, { consumedAt: 900 }), shot(open, MUD, 300), shot(open, MUD, 800)];
    expect(boards(notes, 400, ME).defended.top.map((r) => [name(r.who), r.value])).toEqual([["JHT", 2]]);
    expect(boards(notes, 400, ME).losers.top.map((r) => [name(r.who), r.value])).toEqual([["KQX", 1], ["MUD", 1]]); // the LOSERBOARD: each rival's lost shots
    const many = Array.from({ length: 101 }, (_, i) => record(i ? KQX : ME, 10_000 - i * 10));
    const { records } = boards(many, 400, MUD);
    expect(records.top).toHaveLength(100);
    expect(records.top[0].value).toBe(10_000);
    expect(records.mine).toBeNull();
    expect(boards(many.slice(0, 101), 400, ME).records.mine).toBeNull(); // in the top already
  });
});
