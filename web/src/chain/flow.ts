// The app's decisions, as pure functions so they can be tested without React, WASM or Bread. Copied from GeoQuizz with
// its quiz parts left out.

import type { ChallengeNote } from "./chain";
import { noteDeadline, ZERO_WORD, type AccountFelts, type ChallengeStorage, type Word4 } from "./notes";
import { playable } from "./game";
import { BLOCK_SECONDS, CLAIM_FUZZ, GC_DECIMALS, GC_FAUCET, MIN_SHOT_WINDOW_BLOCKS, RECORD_LIFETIME_BLOCKS, SCORE_MAX, SHOT_DRIVE_BLOCKS, STAKE } from "./config";

export const sameAccount = (a: AccountFelts | null | undefined, b: AccountFelts | null | undefined) =>
  !!a && !!b && a.suffix === b.suffix && a.prefix === b.prefix;

export const sameWord = (a: Word4, b: Word4) => a.every((f, i) => f === b[i]);

const isOpen = (n: ChallengeNote, height: number) => !n.consumed && height < noteDeadline(n);

/** My unconsumed, unexpired shot notes at `record`: one drive settles all of them. */
export function myOpenShotsOn(notes: ChallengeNote[], me: AccountFelts | null, record: ChallengeNote, height: number): ChallengeNote[] {
  if (!me) return [];
  return notes.filter((n) => n.kind === "shot" && sameAccount(me, n.storage.rival) && sameWord(n.storage.recordId, record.idWord) && isOpen(n, height));
}

/** A shot with room for the drive and the claim after it: a shot too close to its deadline is lost before it is driven. */
export const canDrive = (shot: ChallengeNote, height: number) => isOpen(shot, height) && noteDeadline(shot) - height >= SHOT_DRIVE_BLOCKS;

/** Why a shot cannot be taken right now, or null when it can. */
export function shotRefusal(record: ChallengeNote, height: number, me?: AccountFelts | null): string | null {
  if (record.consumed) return "This one is over.";
  // the record script runs the champion's path for its own champion: a shot of theirs could never claim it
  if (sameAccount(me, record.storage.champion)) return "This one is yours.";
  if (record.storage.expiryBlock - height < MIN_SHOT_WINDOW_BLOCKS) return "Too late for this one.";
  const { target, minStake, expiryBlock } = record.storage;
  // terms this game never writes: an unbeatable target, another stake, a record that outlives its day
  if (target >= SCORE_MAX || minStake !== STAKE || expiryBlock > height + RECORD_LIFETIME_BLOCKS) return "This one is rigged.";
  return null;
}

export type NoteKind = { kind: "record"; shotRoot: string } | { kind: "shot" };

/** What a note script root means to this app: a record (and the shot script its shots run), a shot, or null for a foreign note. */
export function noteKind(root: string, current: { recordRoot: string; shotRoot: string }): NoteKind | null {
  if (root === current.recordRoot) return { kind: "record", shotRoot: current.shotRoot };
  if (root === current.shotRoot) return { kind: "shot" };
  return null;
}

/**
 * Whether a note the node serves under our tag with one of our script roots is one of ours: posted by the account it
 * names (the sender is set by the kernel, the storage by whoever made the note), carrying exactly one asset, a Gamecoin,
 * and shaped the way this app writes it. A record names `shotRoot`, the shot script of its own version.
 */
export function acceptNote(n: { kind: "record" | "shot"; storage: ChallengeStorage; sender: AccountFelts; assets: { faucet: string; amount: bigint }[] }, shotRoot?: Word4): boolean {
  if (n.assets.length !== 1 || n.assets[0].faucet !== GC_FAUCET) return false;
  const s = n.storage;
  // a record of another rules version, or whose course is not the one this app grows from its seed, stays out of every list
  if (!playable(s.game)) return false;
  if (n.kind === "record") return sameAccount(n.sender, s.champion) && !s.rival && s.shotDeadline === 0 && sameWord(s.recordId, ZERO_WORD) && !!shotRoot && sameWord(s.shotRoot, shotRoot);
  return sameAccount(n.sender, s.rival) && !sameWord(s.recordId, ZERO_WORD);
}

export type SettlePlan = { won: boolean; claimPrize: boolean; text: string };

/**
 * After a drive: a win settles the open shots (and claims the prize if it is still there); a loss sends nothing, the
 * Gamecoin waits for the champion at the deadline. One shot is one drive: a loss is final.
 */
export function settlePlan(shots: ChallengeNote[], record: ChallengeNote | undefined, score: number, height: number): SettlePlan {
  if (shots.length === 0) throw new Error("no shot note to settle");
  const target = shots[0].storage.target;
  const won = score > target;
  const claimPrize = won && !!record && !record.consumed && record.storage.expiryBlock > height;
  const pts = `${score.toLocaleString("en-US")} points.`;
  const text = claimPrize ? `${pts} You win!` : won ? `${pts} You beat it, but the prize is gone. Your Gamecoin comes back.` : `${pts} Not enough. Your Gamecoin goes to the champion.`;
  return { won, claimPrize, text };
}

/**
 * The wallet took the request but the chain never showed its effect. Bread answers a dApp as soon as the user approves
 * and can still fail afterwards in its own queue, without telling the dApp.
 */
export const NOT_FINISHED = "Not done after 2 minutes. Check your wallet, then try again.";
/** The wallet took too long: a popup left open, or none. Try again looks whether it landed after all before sending again. */
/** Where Bread lives, every platform (Gaylord 2026-10-18) */
export const BREAD_URL = "https://miden.xyz/bread";
export const WALLET_SILENT = "Your wallet did not answer. Open it, then try again.";

/** A block count as m:ss, at testnet's ~3 s per block. */
export const blocksToClock = (blocks: number) => secondsToClock(Math.max(0, blocks) * BLOCK_SECONDS);

/** When `block` lands, in ms, counting from `height` (the chain's current block) at testnet's pace. */
export const blockToMs = (block: number, height: number) => Date.now() + (block - height) * BLOCK_SECONDS * 1000;

export const pad = (v: number) => String(v).padStart(2, "0");

/** m:ss, or h:mm:ss from an hour on. */
export const secondsToClock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:${pad(m)}` : m}:${pad(s % 60)}`;
};

/**
 * Before sending a claim: what the chain already says about the shot(s). Before its deadline only the rival can consume
 * a shot, and only with a winning drive; from deadline + CLAIM_FUZZ on only the champion. So a shot consumed up to there
 * was claimed by its rival, one consumed later was taken.
 */
export function claimVerdict(shots: { consumedAt?: number; deadline: number }[]): "open" | "claimed" | "lost" {
  if (shots.some((s) => s.consumedAt !== undefined && s.consumedAt >= s.deadline + CLAIM_FUZZ + 1)) return "lost";
  if (shots.length > 0 && shots.every((s) => s.consumedAt !== undefined)) return "claimed";
  return "open";
}
export const SHOT_LOST = "Shot lost: too late for the claim. Your Gamecoin goes to the champion.";

export type TroubleKind = "said-no" | "no-wallet" | "funds" | "out-of-step" | "not-finished" | "network" | "not-found" | "already-done" | "too-late" | "refused" | "unknown";
/** What went wrong, in one plain sentence, plus the raw text for "What happened?". */
export type Trouble = { kind: TroubleKind; title: string; detail?: string };

const message = (e: unknown) => (e instanceof Error ? `${e.name !== "Error" ? `${e.name}: ` : ""}${e.message}` : String(e));

/** Turns any failure into words a player understands: no chain, notes or blocks (Gaylord, 2026-10-18). The raw text stays in `detail` for the console. */
export function explain(e: unknown): Trouble {
  const raw = message(e);
  const trouble = (kind: TroubleKind, title: string, withDetail = true): Trouble => (withDetail && raw && raw !== title ? { kind, title, detail: raw } : { kind, title });
  if (raw.includes(NOT_FINISHED)) return trouble("not-finished", NOT_FINISHED, false);
  if (raw.includes(WALLET_SILENT)) return trouble("not-finished", WALLET_SILENT, false);
  if (raw.includes(SHOT_LOST)) return trouble("too-late", SHOT_LOST, false);
  if (/NOT_GRANTED|reject|declin|denied|cancel/i.test(raw)) return trouble("said-no", "You said no in your wallet. Nothing was sent.");
  if (/WalletNotReady|not installed/i.test(raw)) return trouble("no-wallet", "No Bread wallet found. Install it, then try again.");
  if (/WalletNotConnected|not connected|WalletDisconnected/i.test(raw)) return trouble("no-wallet", "Connect your wallet first.");
  if (/^(\w+: )?You need .*Gamecoin/.test(raw)) return trouble("funds", "Not enough Gamecoins in your wallet. Get Gamecoins first.");
  if (/SummaryAnchorMismatch|chain anchor|ChainBehindBoundBlock|block header for block \d+ not found/i.test(raw))
    return trouble("out-of-step", "Your wallet was not ready. Try again.");
  if (/^Too late: /.test(raw)) return trouble("too-late", raw, false);
  if (/already been consumed|already consumed/i.test(raw)) return trouble("already-done", "This was already done.");
  if (/deadline has passed|too late|is over/i.test(raw)) return trouble("too-late", "Too late: this one is over.");
  if (/not found on chain|is not public|not a record or shot|not Pick Up Boomers|Not found/i.test(raw)) return trouble("not-found", "No such record.");
  if (/course does not match/i.test(raw)) return trouble("refused", "This record is not from this game.");
  if (/assertion failed|error code/i.test(raw)) return trouble("refused", "That did not work.");
  if (/faucet/i.test(raw)) return trouble("network", "The Gamecoin faucet is down. Try again later."); // a 503 from the faucet is not the network (2026-10-19)
  if (/fetch|network|timed out|timeout|deadline exceeded|unavailable|transport|ECONN|50[234]|load failed|mempool/i.test(raw))
    return trouble("network", "The network is slow right now. Try again in a moment.");
  return trouble("unknown", "Something went wrong.");
}

/** Rejects with "<what> timed out" (a network trouble) when `p` takes longer than `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} timed out after ${Math.round(ms / 1000)} s`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/**
 * What a wait is, for the player (Gaylord's phone, 2026-10-18: CLAIMING YOUR PRIZE sat there with nothing else): the step,
 * what to do, how long it usually takes, and a clock running since the step began.
 */
export function waiting(b: { stage: "connect" | "prepare" | "wallet" | "network"; since: number }, local = false): [string, string] {
  const clock = secondsToClock(Math.max(0, Math.floor((Date.now() - b.since) / 1000)));
  const [what, how] = b.stage === "connect" ? (local ? ["MAKING THE TEST WALLET", "UP TO A MINUTE"] : ["CONNECTING YOUR WALLET", "APPROVE IN BREAD IF IT ASKS"])
    : b.stage === "prepare" ? ["GETTING READY", "A FEW SECONDS"]
      : b.stage === "wallet" ? (local ? ["PROVING", "UP TO A MINUTE"] : ["OVER TO YOUR WALLET", "APPROVE IT THERE. USUALLY IN LESS THAN 20 SEC"])
        : ["SENDING", "USUALLY IN LESS THAN 20 SEC"]; // Bread proves remotely (local only when that service is down), blocks every 3 s: longer means trouble (Gaylord, 2026-10-19)
  return [what, `${how}  ${clock}`];
}

/** The outcome line once the chain shows the effect: "YOU WIN! DONE!" */
export const doneText = (action: string) => `${/[.!?]$/.test(action) ? action : `${action}.`} DONE!`;

/** Bread had not synced up to the block the request binds yet. */
export const isChainBehind = (e: unknown) => /ChainBehindBoundBlock|has not reached that block/i.test(e instanceof Error ? e.message : String(e));

/** Submits up to `retries` times, retrying only while Bread is behind; `attempt(n)` rebuilds at the fresh tip. */
export async function submitWithRetry<T>(attempt: (n: number) => Promise<T>, retries: number): Promise<T> {
  for (let n = 1; ; n++) {
    try {
      return await attempt(n);
    } catch (e) {
      if (!isChainBehind(e) || n >= retries) throw e;
    }
  }
}

/** Base units to Gamecoins: 1_000_000n is 1. */
export const toGc = (v: bigint) => Number(v) / 10 ** GC_DECIMALS;

/** An amount of Gamecoin in words: "1 Gamecoin", "10 Gamecoins". */
export function fmtGamecoin(v: bigint): string {
  const n = toGc(v);
  return `${n.toLocaleString("en-US", { maximumFractionDigits: GC_DECIMALS })} ${n === 1 ? "Gamecoin" : "Gamecoins"}`;
}

/** The shareable link to a record and the X post that carries it (Gaylord's text, 2026-10-18). The link goes through /r and names the
 *  track and the score: the page served there carries that record's preview card (api/share.py, api/card.py). Vercel serves the static
 *  page for / before any rewrite, so a record link needs its own path. The hashtag is the track id. */
/** The opening of an X post, one drawn per share (Gaylord's list, 2026-10-19), a sentence a line; {score}, {track} and {stake} fill in. */
export const SHARE_LINES = [
  "Try to beat me for {stake} before {until}",
  "{score} pts at PICK UP BOOMERS \u{1F474}\nBeat that before {until} and the Gamecoin is yours \u{1F60E}",
  "I bet {stake} you can't pick up boomers faster than me by {until}",
  "Picked up some boomers \u{1F474}\u{1F475}\nThink you can do better?\nYou got until {until} \u{1F447}",
  "Grandma rated my driving five stars \u2B50\uFE0F\nTry and beat me before {until}",
  "New record on {track}.\nCome get it before {until} \u{1F624}",
  "Champion of {track} until proven otherwise.\nProve it before {until}",
  "Record posted.\nRivals welcome until {until}",
  "I just posted a record in Pick Up Boomers.\nBeat it before {until} and you win my Gamecoin \u2B07\uFE0F",
  "Boomers are the best, millennials are not worth my driving \u{1F474}\u2764\uFE0F\nProve me wrong before {until}",
  "Boomers are the best, Gen Z are not worth my driving \u{1F475}\u2764\uFE0F\nProve me wrong before {until}",
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** When a record runs out, for a rival anywhere: "20 Oct 17:24 UTC" (Gaylord 2026-10-21) */
export const untilText = (ms: number) => { const d = new Date(ms); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`; };

export function recordLinks(recordId: string, songId: string, score: number, track: string, expiresAt: number, roll = Math.random()) {
  const url = `${location.origin}/r?record=${recordId}&t=${songId}&s=${score}`;
  const line = SHARE_LINES[Math.floor(roll * SHARE_LINES.length)].replace("{score}", String(score)).replace("{track}", track.toUpperCase()).replace("{stake}", fmtGamecoin(STAKE)).replace("{until}", untilText(expiresAt));
  const boomers = /[\u{1F474}\u{1F475}]/u.test(line) ? "" : " \u{1F474}\u{1F475}"; // the hashtags carry the boomers unless the line already has one
  const text = `${line}\n#pickupboomers #${songId.replace(/-/g, "")}${boomers}`;
  return { url, x: `https://x.com/intent/post?text=${encodeURIComponent(`${text}\n${url}`)}` };
}
