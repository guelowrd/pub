// The app's decisions, as pure functions so they can be tested without React, WASM or Bread. Copied from GeoQuizz with
// its quiz parts left out.

import type { ChallengeNote } from "./chain";
import { noteDeadline, shotDeadline, ZERO_WORD, type AccountFelts, type ChallengeStorage, type Word4 } from "./notes";
import { BLOCK_SECONDS, CLAIM_FUZZ, GC_DECIMALS, GC_FAUCET, MIN_SHOT_WINDOW_BLOCKS, RECORD_LIFETIME_BLOCKS, SCORE_MAX, STAKE } from "./config";

export const sameAccount = (a: AccountFelts | null | undefined, b: AccountFelts | null | undefined) =>
  !!a && !!b && a.suffix === b.suffix && a.prefix === b.prefix;

export const sameWord = (a: Word4, b: Word4) => a.every((f, i) => f === b[i]);

const isOpen = (n: ChallengeNote, height: number) => !n.consumed && height < noteDeadline(n);

/** My unconsumed, unexpired shot notes at `record`: one drive settles all of them. */
export function myOpenShotsOn(notes: ChallengeNote[], me: AccountFelts | null, record: ChallengeNote, height: number): ChallengeNote[] {
  if (!me) return [];
  return notes.filter((n) => n.kind === "shot" && sameAccount(me, n.storage.rival) && sameWord(n.storage.recordId, record.idWord) && isOpen(n, height));
}

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
  if (n.kind === "record") return sameAccount(n.sender, s.champion) && !s.rival && s.shotDeadline === 0 && sameWord(s.recordId, ZERO_WORD) && !!shotRoot && sameWord(s.shotRoot, shotRoot);
  return sameAccount(n.sender, s.rival) && !sameWord(s.recordId, ZERO_WORD);
}

/** `again`: a lost shot still open, so the same course can be driven once more for free. */
export type SettlePlan = { won: boolean; claimPrize: boolean; again: boolean; text: string };

/**
 * After a drive: a win settles the open shots (and claims the prize if it is still there); a loss sends nothing to the
 * chain, the Gamecoin waits for the champion at the deadline.
 */
export function settlePlan(shots: ChallengeNote[], record: ChallengeNote | undefined, score: number, height: number): SettlePlan {
  if (shots.length === 0) throw new Error("no shot note to settle");
  const target = shots[0].storage.target;
  const won = score > target;
  const claimPrize = won && !!record && !record.consumed && record.storage.expiryBlock > height;
  const again = !won && height < shotDeadline(shots[0].storage);
  const text = claimPrize ? `${score} points. You win!`
    : won ? `${score} points. You beat it, but the prize is gone. Your Gamecoin comes back.`
      : again ? `${score} points. Not enough.`
        : `${score} points. Not enough. Your Gamecoin goes to the champion.`;
  return { won, claimPrize, again, text };
}

/**
 * The wallet took the request but the chain never showed its effect. Bread answers a dApp as soon as the user approves
 * and can still fail afterwards in its own queue, without telling the dApp.
 */
export const NOT_FINISHED = "It did not go through yet. Nothing is spent until it does, so try again.";

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
export const SHOT_LOST = "Too late: your shot ended before the claim. The champion can take your Gamecoin.";

export type TroubleKind = "said-no" | "no-wallet" | "funds" | "out-of-step" | "not-finished" | "network" | "not-found" | "already-done" | "too-late" | "refused" | "unknown";
/** What went wrong, in one plain sentence, plus the raw text for "What happened?". */
export type Trouble = { kind: TroubleKind; title: string; detail?: string };

const message = (e: unknown) => (e instanceof Error ? `${e.name !== "Error" ? `${e.name}: ` : ""}${e.message}` : String(e));

/** Turns any failure into words a player understands. The raw text stays in `detail`. */
export function explain(e: unknown): Trouble {
  const raw = message(e);
  const trouble = (kind: TroubleKind, title: string, withDetail = true): Trouble => (withDetail && raw && raw !== title ? { kind, title, detail: raw } : { kind, title });
  if (raw.includes(NOT_FINISHED)) return trouble("not-finished", NOT_FINISHED, false);
  if (/NOT_GRANTED|reject|declin|denied|cancel/i.test(raw)) return trouble("said-no", "You said no in your wallet. Nothing was sent.");
  if (/WalletNotReady|not installed/i.test(raw)) return trouble("no-wallet", "No Bread wallet found. Install it, then try again.");
  if (/WalletNotConnected|not connected|WalletDisconnected/i.test(raw)) return trouble("no-wallet", "Connect your wallet first.");
  if (/^(\w+: )?You need .*Gamecoin/.test(raw)) return trouble("funds", "Not enough Gamecoins in your wallet. Get Gamecoins first.");
  if (/SummaryAnchorMismatch|chain anchor|ChainBehindBoundBlock|block header for block \d+ not found/i.test(raw))
    return trouble("out-of-step", "Your wallet was out of step with the network. Try again.");
  if (/^Too late: /.test(raw)) return trouble("too-late", raw, false);
  if (/already been consumed|already consumed/i.test(raw)) return trouble("already-done", "This was already done.");
  if (/deadline has passed|too late|is over/i.test(raw)) return trouble("too-late", "Too late: this one is over.");
  if (/not found on chain|is not public|not a record or shot|not Pick Up Boomers|Not found/i.test(raw)) return trouble("not-found", "That record is not on the chain.");
  if (/course does not match/i.test(raw)) return trouble("refused", "This record's course is not one this game makes.");
  if (/assertion failed|error code/i.test(raw)) return trouble("refused", "The game said no to this move.");
  if (/fetch|network|timed out|timeout|deadline exceeded|unavailable|transport|ECONN|50[234]|load failed|faucet|mempool/i.test(raw))
    return trouble("network", "The Miden network is slow or busy right now. Try again in a moment.");
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

/** The outcome line after Bread accepted a request: only a chain-confirmed effect is "confirmed". */
export function outcomeText(action: string, seenOnChain: boolean): string {
  const sentence = /[.!?]$/.test(action) ? action : `${action}.`;
  return seenOnChain ? `${sentence} Done!` : `${action}… not done yet. Check your wallet.`;
}

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
  return `${n.toLocaleString(undefined, { maximumFractionDigits: GC_DECIMALS })} ${n === 1 ? "Gamecoin" : "Gamecoins"}`;
}

/** "1 GC", "2.5 GC": what fits a head-unit row. */
export const fmtGc = (v: bigint) => `${toGc(v).toLocaleString(undefined, { maximumFractionDigits: GC_DECIMALS })} GC`;

/** A moment in UTC, for readers anywhere: 13 Oct 14:05 UTC. */
function utcLabel(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCDate())} ${d.toLocaleString("en", { month: "short", timeZone: "UTC" })} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

// the X post: one of these, the record picks which (so a record always shares the same line); the link follows on its own line
const POSTS: ((score: number, until: string, song: string) => string)[] = [
  (score, until, song) => `${score} points on Pick Up Boomers, driving to ${song} 🚗\nInstall @joinbread & beat my record before ${until}.`,
  (score, until, song) => `My Pick Up Boomers record: ${score} points on ${song}, open until ${until}.\nInstall @joinbread & beat it.`,
  (score, until, song) => `${score} points, three minutes of ${song}. One Gamecoin says you can't beat it before ${until}.\nInstall @joinbread & prove me wrong.`,
  (score, until, song) => `Boomers picked up, ${score} points banked on ${song}. Your move, until ${until}.\nInstall @joinbread & take a shot.`,
];

/** The shareable link to a record, and the X post that carries it; `expiresAt` is the record's expiry in ms. */
export function recordLinks(recordId: string, score: number, expiresAt: number, song: string) {
  const url = `${location.origin}${location.pathname}?record=${recordId}`;
  const pick = [...recordId].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const text = POSTS[pick % POSTS.length](score, utcLabel(expiresAt), song);
  return { url, x: `https://x.com/intent/post?text=${encodeURIComponent(`${text}\n${url}`)}` };
}
