// Past games and the public boards, read from the game's public notes: nobody reports a result, the chain tells how each
// record and shot ended. Pure: notes (with the blocks they were made and consumed in) come in, rows come out. Copied
// from GeoQuizz without its maps and languages.

import type { ChallengeNote } from "./chain";
import { fmtGamecoin, sameAccount as same, toGc } from "./flow";
import { isShotAt, noteDeadline, shotDeadline, type AccountFelts } from "./notes";
import { CLAIM_FUZZ } from "./config";

export const keyOf = (a: AccountFelts) => `${a.prefix}:${a.suffix}`;

/** Letters of an address read from its end: digits and the wallet's `_…` routing part left out. */
export function lettersBackward(address: string): string {
  const id = address.split("_")[0];
  return [...id.slice(id.lastIndexOf("1") + 1)]
    .reverse()
    .filter((c) => /[a-z]/i.test(c))
    .join("")
    .toUpperCase();
}

/**
 * Arcade names: the first three letters of the address read backward (…nthj9 → JHT). A name already taken keeps its
 * first two letters and takes the next letter further back (JHN, then JHL…), so whoever played first keeps theirs.
 * `players` come in the order they first played.
 * ponytail: when every third letter is taken (some 25 of them) the name repeats; vary the second letter then.
 */
export function nicknames(players: { key: string; address: string }[]): Map<string, string> {
  const names = new Map<string, string>();
  const taken = new Set<string>();
  for (const { key, address } of players) {
    if (names.has(key)) continue;
    const letters = lettersBackward(address);
    let name = letters.slice(0, 3);
    for (let i = 3; taken.has(name) && i < letters.length; i++) name = letters.slice(0, 2) + letters[i];
    taken.add(name);
    names.set(key, name);
  }
  return names;
}

/** Everyone who played, in the order they first did: a champion from a record, a rival from a shot. */
export function playersInOrder(notes: ChallengeNote[]): AccountFelts[] {
  const plays = notes
    .flatMap((n) => {
      const who = n.kind === "record" ? n.storage.champion : n.storage.rival;
      return who ? [{ who, at: n.createdAt ?? Infinity }] : [];
    })
    .sort((a, b) => a.at - b.at || (keyOf(a.who) < keyOf(b.who) ? -1 : 1));
  const seen = new Map<string, AccountFelts>();
  for (const { who } of plays) if (!seen.has(keyOf(who))) seen.set(keyOf(who), who);
  return [...seen.values()];
}

/**
 * How a shot ended. Before its deadline only its rival can consume it, and only with a winning drive; a claim proved
 * before the deadline lands at most CLAIM_FUZZ blocks after it, and the champion may only collect from deadline +
 * CLAIM_FUZZ on. So the block it was consumed in tells: won up to there, taken after. undefined while the node has not
 * said when it was consumed.
 */
export function shotOutcome(shot: ChallengeNote, height: number): "won" | "lost" | "open" | undefined {
  const deadline = shotDeadline(shot.storage);
  if (!shot.consumed) return height >= deadline ? "lost" : "open";
  if (shot.consumedAt === undefined) return undefined;
  return shot.consumedAt <= deadline + CLAIM_FUZZ ? "won" : "lost";
}

/**
 * What the champion `me` can take now: their open records and the lost shots at them, CLAIM_FUZZ blocks past the
 * deadline (a claim proved just before it lands until then). A shot I posted at my own record never: its script serves
 * the rival first.
 */
export function owed(notes: ChallengeNote[], height: number, me: AccountFelts | null): ChallengeNote[] {
  if (!me) return [];
  return notes.filter((n) => !n.consumed && same(me, n.storage.champion) && !(n.kind === "shot" && same(me, n.storage.rival)) && height >= noteDeadline(n) + CLAIM_FUZZ);
}

/** How a record ended: smashed (consumed before the champion could take it back, which only a winner can do), closed (expired) or open. */
export function recordOutcome(record: ChallengeNote, height: number): "smashed" | "closed" | "open" | undefined {
  const expiry = record.storage.expiryBlock;
  const takeBack = expiry + CLAIM_FUZZ + 1;
  if (record.consumed) return record.consumedAt === undefined ? undefined : record.consumedAt < takeBack ? "smashed" : "closed";
  return height >= expiry ? "closed" : "open";
}

// a shot belongs to a record by its full terms (isShotAt), not its record id alone
export const shotsAt = (record: ChallengeNote, notes: ChallengeNote[]) => notes.filter((n) => n.kind === "shot" && isShotAt(n.storage, record.storage, record.idWord));
export const recordOf = (shot: ChallengeNote, notes: ChallengeNote[]) => notes.find((n) => n.kind === "record" && isShotAt(shot.storage, n.storage, n.idWord));

/** Shots at `record` lost so far, or null while one of them waits for the node. */
export function triesLost(record: ChallengeNote, notes: ChallengeNote[], height: number): number | null {
  const outcomes = shotsAt(record, notes).map((s) => shotOutcome(s, height));
  return outcomes.includes(undefined) ? null : outcomes.filter((o) => o === "lost").length;
}

/** Who smashed `record`: the rival of the winning shot consumed in the same transaction. */
function winner(record: ChallengeNote, notes: ChallengeNote[], height: number): AccountFelts | undefined {
  const shot = shotsAt(record, notes).find((s) => s.consumedAt === record.consumedAt && shotOutcome(s, height) === "won");
  return shot?.storage.rival ?? undefined;
}

/** Gamecoins a champion took from shots lost at `record`: the lost ones already consumed. */
const collected = (record: ChallengeNote, notes: ChallengeNote[], height: number) =>
  shotsAt(record, notes).reduce((sum, s) => (s.consumedAt !== undefined && shotOutcome(s, height) === "lost" ? sum + s.amount : sum), 0n);

export type Tone = "pink" | "mint" | "";
/** A past game, one head-unit row: the result, whose record, my score, the money that moved. Never a rival's exact score. */
export type HistoryItem = { id: string; kind: "record" | "shot"; at: number; result: string; context: string; score: number; detail: string; money: string; note: string; tone: Tone; moneyTone: Tone };

/** My finished games, newest first: my records and my shots once consumed (live ones stay on the cards). */
export function history(notes: ChallengeNote[], me: AccountFelts, height: number, name: (a: AccountFelts) => string): HistoryItem[] {
  const items: HistoryItem[] = [];
  for (const n of notes) {
    // a shot of mine past its deadline is lost before anyone touches it: history from the deadline on
    const lostOnTable = n.kind === "shot" && !n.consumed && same(n.storage.rival, me) && shotOutcome(n, height) === "lost";
    if (lostOnTable) {
      const who = name(n.storage.champion);
      // the shot script serves its rival first: a shot at my own record stays locked past its deadline
      const note = same(n.storage.champion, me) ? "Locked: this shot was at your own record." : `${who} can take the coin.`;
      items.push({ id: n.id, kind: "shot", at: shotDeadline(n.storage), score: n.storage.target, result: "You lost", context: `${who}'s record: `, detail: "", money: `${fmtGamecoin(n.amount)} lost`, note, tone: "pink", moneyTone: "pink" });
      continue;
    }
    if (n.consumedAt === undefined) continue;
    const base = { id: n.id, kind: n.kind, at: n.consumedAt, score: n.storage.target, context: "", detail: "", note: "" };
    if (n.kind === "record" && same(n.storage.champion, me)) {
      const lost = triesLost(n, notes, height);
      if (lost === null) continue;
      const won = collected(n, notes, height);
      const tries = lost === 1 ? "1 try lost" : `${lost} tries lost`;
      if (recordOutcome(n, height) === "smashed") {
        const w = winner(n, notes, height);
        const who = w ? name(w) : "Someone";
        // the prize is lost either way; what earlier losers paid stands next to it, never instead of it
        const money = won > 0n ? { money: `${fmtGamecoin(won)} won, ${toGc(n.amount)} lost`, moneyTone: "" as const } : { money: `${fmtGamecoin(n.amount)} lost`, moneyTone: "pink" as const };
        items.push({ ...base, result: "Beaten", context: `${who} beat `, detail: tries, tone: "pink", note: `Prize went to ${who}.`, ...money });
      } else if (lost > 0) {
        const money = won > 0n ? { money: `${fmtGamecoin(won)} won`, moneyTone: "mint" as const, note: "Your Gamecoin back." } : { money: `${fmtGamecoin(n.amount)} back`, moneyTone: "" as const };
        items.push({ ...base, result: "Defended", detail: tries, tone: "mint", ...money });
      } else items.push({ ...base, result: "Taken back", detail: shotsAt(n, notes).length === 0 ? "Nobody tried." : "", money: `${fmtGamecoin(n.amount)} back`, tone: "", moneyTone: "" });
    } else if (n.kind === "shot" && same(n.storage.rival, me)) {
      const who = name(n.storage.champion);
      const record = recordOf(n, notes);
      const shot = { ...base, context: `${who}'s record: ` };
      if (shotOutcome(n, height) === "lost") items.push({ ...shot, result: "You lost", money: `${fmtGamecoin(n.amount)} lost`, note: `Went to ${who}.`, tone: "pink", moneyTone: "pink" });
      // the prize comes with the shot in one transaction: same block
      else if (record && record.consumedAt === n.consumedAt) items.push({ ...shot, result: "You won", money: `${fmtGamecoin(record.amount)} won`, note: "Your Gamecoin back.", tone: "mint", moneyTone: "mint" });
      else items.push({ ...shot, result: "You won", detail: record && record.consumedAt !== undefined && record.consumedAt < n.consumedAt ? "Prize already taken." : "", money: `${fmtGamecoin(n.amount)} back`, tone: "mint", moneyTone: "" });
    }
  }
  return items.sort((a, b) => b.at - a.at);
}

export type Ranked = { key: string; who: AccountFelts; value: number; at: number; rank: number };
/** The top rows (10, 100 records), and my best row when I am not among them. */
export type Board = { top: Ranked[]; mine: Ranked | null };
type Hit = { who: AccountFelts; value: number; at: number };

/** Totals per player; a total's `at` is the block it reached its final value. */
function tally(events: Hit[]): Omit<Ranked, "rank">[] {
  const rows = new Map<string, Omit<Ranked, "rank">>();
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    const key = keyOf(e.who);
    rows.set(key, { key, who: e.who, value: (rows.get(key)?.value ?? 0) + e.value, at: e.at });
  }
  return [...rows.values()];
}

/** High to low, the first `limit` rows; a tie goes to whoever got there first. */
function rank(rows: Omit<Ranked, "rank">[], me: AccountFelts | null, limit = 10): Board {
  const sorted = [...rows].sort((a, b) => b.value - a.value || a.at - b.at || (a.key < b.key ? -1 : 1)).map((r, i) => ({ ...r, rank: i + 1 }));
  const top = sorted.slice(0, limit);
  const mine = top.some((r) => same(r.who, me)) ? null : (sorted.find((r) => same(r.who, me)) ?? null);
  return { top, mine };
}

/**
 * The boards. Gamecoins won: lost shots a champion took, plus prizes (a winner's own Gamecoin coming back is not a win).
 * Best records: every record posted, by its score, a hundred of them. Defended: every rival who lost at one of the
 * champion's records, open or not. Smashed: records a rival took.
 */
export function boards(notes: ChallengeNote[], height: number, me: AccountFelts | null) {
  const coins: Hit[] = [];
  const defended: Hit[] = [];
  const smashed: Hit[] = [];
  const losers: Hit[] = []; // the LOSERBOARD: each rival's lost shots (GQ's rule)
  for (const n of notes) {
    if (n.kind === "shot") {
      const record = recordOf(n, notes);
      if (!record || shotOutcome(n, height) !== "lost") continue;
      defended.push({ who: n.storage.champion, value: 1, at: shotDeadline(n.storage) });
      if (n.storage.rival) losers.push({ who: n.storage.rival, value: 1, at: shotDeadline(n.storage) });
      if (n.consumedAt !== undefined) coins.push({ who: n.storage.champion, value: toGc(n.amount), at: n.consumedAt });
      continue;
    }
    const w = recordOutcome(n, height) === "smashed" ? winner(n, notes, height) : undefined;
    if (w) {
      coins.push({ who: w, value: toGc(n.amount), at: n.consumedAt! });
      smashed.push({ who: w, value: 1, at: n.consumedAt! });
    }
  }
  const records = notes.filter((n) => n.kind === "record").map((n) => ({ key: n.id, who: n.storage.champion, value: n.storage.target, at: n.createdAt ?? Infinity }));
  return { coins: rank(tally(coins), me), records: rank(records, me, 100), defended: rank(tally(defended), me), smashed: rank(tally(smashed), me), losers: rank(tally(losers), me) };
}
