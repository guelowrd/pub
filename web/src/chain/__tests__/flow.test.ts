// The app's decisions, one test per rule (copied from GeoQuizz, its quiz cases left out).
import { describe, expect, it, vi } from "vitest";
import type { ChallengeNote } from "../chain";
import type { ChallengeStorage, Word4 } from "../notes";
import { GC_FAUCET, MIN_SHOT_WINDOW_BLOCKS, SCORE_MAX, SHOT_DRIVE_BLOCKS } from "../config";
import { encodeGame, newGame, RULES_VERSION } from "../game";
import { acceptNote, blocksToClock, canDrive, claimVerdict, explain, fmtGamecoin, isChainBehind, myOpenShotsOn, NOT_FINISHED, WALLET_SILENT, waiting, noteKind, doneText, recordLinks, settlePlan, shotRefusal, submitWithRetry, withTimeout } from "../flow";

const champion = { suffix: 1n, prefix: 2n };
const me = { suffix: 3n, prefix: 4n };
const other = { suffix: 5n, prefix: 6n };
const recordId = [9n, 9n, 9n, 9n] as const;

const base: ChallengeStorage = { expiryBlock: 1000, target: 2000, minStake: 1_000_000n, champion, rival: null, recordId: [0n, 0n, 0n, 0n], shotRoot: [1n, 1n, 1n, 1n], game: encodeGame(newGame(7, 0)), shotDeadline: 0 };
const prize: ChallengeNote = { id: "0x9", idWord: [...recordId], kind: "record", storage: base, faucet: GC_FAUCET, amount: 1_000_000n, consumed: false };
const challenge = (rival: typeof me, deadline: number, consumed = false, id = "0xc"): ChallengeNote => ({
  id, idWord: [1n, 2n, 3n, 4n], kind: "shot", storage: { ...base, rival, recordId: [...recordId], shotDeadline: deadline }, faucet: GC_FAUCET, amount: 1_000_000n, consumed,
});

describe("open shots at a record", () => {
  it("finds every open note of mine on that record and nothing else", () => {
    const notes = [
      challenge(me, 500, false, "0xa"),
      challenge(me, 500, false, "0xb"),
      challenge(me, 500, true, "0xconsumed"),
      challenge(me, 90, false, "0xexpired"),
      challenge(other, 500, false, "0xtheirs"),
      { ...challenge(me, 500, false, "0xotherprize"), storage: { ...challenge(me, 500).storage, recordId: [7n, 7n, 7n, 7n] as Word4 } },
    ];
    expect(myOpenShotsOn(notes, me, prize, 100).map((n) => n.id)).toEqual(["0xa", "0xb"]);
    expect(myOpenShotsOn(notes, null, prize, 100)).toEqual([]);
  });

  it("a shot is closed from its own deadline or the record expiry, whichever first", () => {
    expect(myOpenShotsOn([challenge(me, 2000)], me, prize, 999)).toHaveLength(1);
    expect(myOpenShotsOn([challenge(me, 2000)], me, prize, 1000)).toHaveLength(0);
    expect(myOpenShotsOn([challenge(me, 120)], me, prize, 120)).toHaveLength(0);
  });

  it("a shot is driven only with room for the drive and the claim after it", () => {
    expect(canDrive(challenge(me, 1000), 1000 - SHOT_DRIVE_BLOCKS)).toBe(true);
    expect(canDrive(challenge(me, 1000), 1000 - SHOT_DRIVE_BLOCKS + 1)).toBe(false);
    expect(canDrive({ ...challenge(me, 1000), consumed: true }, 500)).toBe(false);
  });
});

describe("taking a shot", () => {
  it("refuses a claimed record or one about to expire", () => {
    expect(shotRefusal(prize, 100)).toBeNull();
    expect(shotRefusal(prize, 1000 - MIN_SHOT_WINDOW_BLOCKS)).toBeNull();
    expect(shotRefusal(prize, 1000 - MIN_SHOT_WINDOW_BLOCKS + 1)).toMatch(/too late/i);
    expect(shotRefusal({ ...prize, consumed: true }, 100)).toMatch(/over/);
  });

  it("refuses my own record: the claim would run the champion's path, which only opens after expiry", () => {
    expect(shotRefusal(prize, 100, champion)).toBe("This one is yours.");
    expect(shotRefusal(prize, 100, me)).toBeNull();
  });

  it("refuses a record whose terms the game could never produce", () => {
    const rigged = (storage: Partial<ChallengeStorage>) => shotRefusal({ ...prize, storage: { ...base, ...storage } }, 100);
    expect(rigged({ target: SCORE_MAX - 1 })).toBeNull();
    expect(rigged({ target: SCORE_MAX })).toMatch(/rigged/);
    expect(rigged({ minStake: 999_999n })).toMatch(/rigged/);
    expect(rigged({ minStake: 1_000_001n })).toMatch(/rigged/);
    expect(rigged({ expiryBlock: 100 + 28_800 })).toBeNull();
    expect(rigged({ expiryBlock: 100 + 28_801 })).toMatch(/rigged/);
  });
});

describe("script roots", () => {
  const current = { recordRoot: "0xr", shotRoot: "0xs" };
  it("a record names the shot script its shots run; a foreign root is nothing", () => {
    expect(noteKind("0xr", current)).toEqual({ kind: "record", shotRoot: "0xs" });
    expect(noteKind("0xs", current)).toEqual({ kind: "shot" });
    expect(noteKind("0xother", current)).toBeNull();
  });
});

describe("accepting a note from the chain", () => {
  const gc = { faucet: GC_FAUCET, amount: 1_000_000n };
  const shotRoot = base.shotRoot;
  const record = { kind: "record" as const, storage: base, sender: champion, assets: [gc] };
  const shot = { kind: "shot" as const, storage: { ...base, rival: me, recordId: [...recordId] as Word4, shotDeadline: 200 }, sender: me, assets: [gc] };

  it("takes a record only from its champion, a shot only from its rival", () => {
    expect(acceptNote(record, shotRoot)).toBe(true);
    expect(acceptNote(shot, shotRoot)).toBe(true);
    expect(acceptNote({ ...record, sender: other }, shotRoot)).toBe(false);
    expect(acceptNote({ ...shot, sender: champion }, shotRoot)).toBe(false);
  });

  it("wants exactly one asset, a Gamecoin", () => {
    expect(acceptNote({ ...record, assets: [] }, shotRoot)).toBe(false);
    expect(acceptNote({ ...record, assets: [{ faucet: "0xbad", amount: 1_000_000n }] }, shotRoot)).toBe(false);
    expect(acceptNote({ ...record, assets: [gc, { faucet: "0xbad", amount: 1n }] }, shotRoot)).toBe(false);
  });

  it("a record names this game's shot script and no rival, deadline or record id", () => {
    expect(acceptNote({ ...record, storage: { ...base, shotRoot: [2n, 2n, 2n, 2n] } }, shotRoot)).toBe(false);
    expect(acceptNote({ ...record, storage: { ...base, rival: me } }, shotRoot)).toBe(false);
    expect(acceptNote({ ...record, storage: { ...base, shotDeadline: 5 } }, shotRoot)).toBe(false);
    expect(acceptNote({ ...record, storage: { ...base, recordId: [...recordId] as Word4 } }, shotRoot)).toBe(false);
    expect(acceptNote({ ...shot, storage: { ...shot.storage, recordId: [0n, 0n, 0n, 0n] } }, shotRoot)).toBe(false);
  });

  it("keeps only records and shots this app can drive: this rules version, the course grown from the seed", () => {
    const game = encodeGame(newGame(7, 0));
    const older = game.map((f, i) => (i === 5 ? RULES_VERSION - 1n : f));
    const foreign = game.map((f, i) => (i === 8 ? f + 1n : f));
    expect(acceptNote({ ...record, storage: { ...base, game: older } }, shotRoot)).toBe(false);
    expect(acceptNote({ ...record, storage: { ...base, game: foreign } }, shotRoot)).toBe(false);
    expect(acceptNote({ ...shot, storage: { ...shot.storage, game: foreign } }, shotRoot)).toBe(false);
    expect(acceptNote({ ...record, storage: { ...base, game: [] } }, shotRoot)).toBe(false);
  });
});

describe("settling after a drive", () => {
  it("claims the prize with every open shot on a win", () => {
    const plan = settlePlan([challenge(me, 500, false, "0xa"), challenge(me, 500, false, "0xb")], prize, 2001, 100);
    expect(plan).toMatchObject({ won: true, claimPrize: true });
    expect(plan.text).toMatch(/You win!/);
  });

  it("only recovers the stake when the prize is gone, and forfeits on a loss or a tie", () => {
    expect(settlePlan([challenge(me, 500)], { ...prize, consumed: true }, 2001, 100)).toMatchObject({ won: true, claimPrize: false });
    expect(settlePlan([challenge(me, 500)], undefined, 2001, 100).text).toMatch(/Gamecoin comes back/);
    expect(settlePlan([challenge(me, 500)], prize, 2000, 100)).toMatchObject({ won: false, claimPrize: false });
    expect(settlePlan([challenge(me, 500)], prize, 1999, 100).text).toMatch(/^1,999 points\. Not enough\. Your Gamecoin goes to the champion\.$/);
    expect(() => settlePlan([], prize, 5000, 100)).toThrow();
  });
});

describe("what the chain says before a claim", () => {
  it("open until every shot is used; claimed when all were used in time; lost when one was taken late", () => {
    expect(claimVerdict([{ deadline: 100 }])).toBe("open");
    expect(claimVerdict([{ consumedAt: 90, deadline: 100 }, { deadline: 100 }])).toBe("open");
    expect(claimVerdict([{ consumedAt: 164, deadline: 100 }])).toBe("claimed");
    expect(claimVerdict([{ consumedAt: 165, deadline: 100 }])).toBe("lost");
    expect(claimVerdict([])).toBe("open");
  });
});

describe("plain words for failures", () => {
  it("names the usual troubles and keeps the raw text", () => {
    expect(explain(new Error("User rejected the request")).kind).toBe("said-no");
    expect(explain(new Error("WalletNotConnectedError")).kind).toBe("no-wallet");
    expect(explain(new Error("You need 1 Gamecoin and your wallet holds 0 Gamecoins. Get Gamecoins first."))).toMatchObject({ kind: "funds" });
    expect(explain(Object.assign(new Error("the Miden client synced to block 1"), { name: "ChainBehindBoundBlockError" })).kind).toBe("out-of-step");
    expect(explain(new Error(NOT_FINISHED))).toEqual({ kind: "not-finished", title: NOT_FINISHED });
    expect(explain(new Error(WALLET_SILENT))).toEqual({ kind: "not-finished", title: WALLET_SILENT });
    expect(explain(new Error("fetch failed"))).toMatchObject({ kind: "network", detail: "fetch failed" });
    expect(explain(new Error("assertion failed with error code: 123")).kind).toBe("refused");
    expect(explain(new Error("This record's course does not match")).kind).toBe("refused");
    expect(explain(new Error("not Pick Up Boomers game data")).kind).toBe("not-found");
    expect(explain("??")).toMatchObject({ kind: "unknown", detail: "??" });
  });

  it("times a slow promise out with a network trouble", async () => {
    await expect(withTimeout(new Promise(() => {}), 10, "Syncing")).rejects.toThrow(/Syncing timed out/);
    await expect(withTimeout(Promise.resolve(1), 10, "x")).resolves.toBe(1);
  });
});

describe("outcome wording", () => {
  it("says done in the screen's own case", () => {
    expect(doneText("POSTING")).toBe("POSTING. DONE!");
    expect(doneText("5,200 POINTS. YOU WIN!")).toBe("5,200 POINTS. YOU WIN! DONE!");
  });
});

describe("submitting through Bread", () => {
  const behind = new Error("ChainBehindBoundBlockError: the Miden client synced to block 5, below block 6 the proposal binds; its node has not reached that block yet");

  it("retries only while Bread is behind the bound block, up to the budget", async () => {
    const attempt = vi.fn<(n: number) => Promise<string>>().mockRejectedValueOnce(behind).mockResolvedValue("tx");
    await expect(submitWithRetry(attempt, 3)).resolves.toBe("tx");
    expect(attempt.mock.calls.map(([n]) => n)).toEqual([1, 2]);
    const always = vi.fn().mockRejectedValue(behind);
    await expect(submitWithRetry(always, 3)).rejects.toBe(behind);
    expect(always).toHaveBeenCalledTimes(3);
    const other = vi.fn().mockRejectedValue(new Error("You need 1 GC"));
    await expect(submitWithRetry(other, 3)).rejects.toThrow(/GC/);
    expect(other).toHaveBeenCalledTimes(1);
  });

  it("recognises Bread being behind, and nothing else", () => {
    expect(isChainBehind(behind)).toBe(true);
    expect(isChainBehind(new Error("insufficient balance"))).toBe(false);
  });
});

describe("a wait, for the player", () => {
  it("names the step, what to do and how long, with a clock since the step began", () => {
    expect(waiting({ stage: "wallet", since: Date.now() - 12_000 })).toEqual(["OVER TO YOUR WALLET", "APPROVE IT THERE. USUALLY IN LESS THAN 20 SEC  0:12"]);
    expect(waiting({ stage: "wallet", since: Date.now() }, true)[0]).toBe("PROVING");
    expect(waiting({ stage: "network", since: Date.now() })[1]).toMatch(/^USUALLY IN LESS THAN 20 SEC  0:0\d$/);
  });
});

describe("Gamecoin in words", () => {
  it("spells the token out, singular and plural", () => {
    expect(fmtGamecoin(1_000_000n)).toBe("1 Gamecoin");
    expect(fmtGamecoin(10_000_000n)).toBe("10 Gamecoins");
    expect(fmtGamecoin(2_500_000n)).toBe("2.5 Gamecoins");
  });
  it("shares a record as a ?record= link, inside the X post too, with the stake and the station as a hashtag", () => {
    vi.stubGlobal("location", { origin: "http://pub", pathname: "/" });
    const { url, x } = recordLinks("0xabc", "midnight-chase", 9690);
    expect(url).toBe("http://pub/r?record=0xabc&t=midnight-chase&s=9690");
    expect(new URL(x).searchParams.get("text")).toBe(`Try to beat me for 1 Gamecoin\n#pickupboomers #midnightchase \u{1F474}\u{1F475}\n${url}`);
    vi.unstubAllGlobals();
  });
  it("shows blocks as a clock at 3 s a block", () => {
    expect(blocksToClock(20)).toBe("1:00");
    expect(blocksToClock(1300)).toBe("1:05:00");
    expect(blocksToClock(-5)).toBe("0:00");
  });
});
