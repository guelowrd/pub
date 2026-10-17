// Pick Up Boomers' game data and claim answer, host side; mirrors integration/src/game.rs and what
// masm/games/pub_score.masm reads. Game data: SEED(4) | song, rules version, 0, 0 | COURSE commitment (4). The course
// (28 streets x 8 felts) and the decision log travel in the advice map under their commitments: the chain cannot grow a
// course from a seed, so a rival's client regrows it and refuses a record whose commitment does not match.
import { Poseidon2 } from "@miden-sdk/miden-sdk";
import { feltArray } from "./chain";
import type { GameAnswer, Word4 } from "./notes";
import { packCourse, packLog } from "../game/chain";
import { pyramid } from "../game/course";
import type { Event } from "../game/sim";

// Bump it whenever the course generator changes (the COURSE_COMMIT pin in __tests__/game.test.ts moves): a record of
// another version grew a course this app cannot regrow, so nobody could drive it.
// 1: first courses; 2: the course starts in the song's district (Stage TV); 3: a feel per song, every waterfront street rises
export const RULES_VERSION = 3n;
export const GAME_FELTS = 12;

export type PubGame = { seed: number; song: number; courseCommit: Word4 };

/** The commitment to a list of felts, the way `note::compute_storage_commitment` makes it on the chain. */
export function commitment(felts: bigint[]): Word4 {
  return Poseidon2.hashElements(feltArray(felts)).toFelts().map((f) => f.asInt()) as Word4;
}

/** The packed course of `seed` and `song`, as the chain replays it. */
export const courseFelts = (seed: number, song: number): bigint[] => packCourse(pyramid(seed, song)).map(BigInt);

export function encodeGame(g: PubGame): bigint[] {
  return [BigInt(g.seed), 0n, 0n, 0n, BigInt(g.song), RULES_VERSION, 0n, 0n, ...g.courseCommit];
}

/** A record's game data, or an error when it is not this game's (another version, a seed or song out of range). */
export function decodeGame(felts: bigint[]): PubGame {
  if (felts.length !== GAME_FELTS || felts[5] !== RULES_VERSION) throw new Error("not Pick Up Boomers game data");
  const seed = Number(felts[0]), song = Number(felts[4]);
  if (felts[1] || felts[2] || felts[3] || felts[6] || felts[7] || seed > 0xffff_ffff || song > 255) throw new Error("not Pick Up Boomers game data");
  return { seed, song, courseCommit: felts.slice(8, 12) as Word4 };
}

/** The game data of a fresh record: the course grown from `seed`, committed. */
export const newGame = (seed: number, song: number): PubGame => ({ seed, song, courseCommit: commitment(courseFelts(seed, song)) });

/** True when `g`'s course commitment is the one this app grows from its seed: a rival can drive it. */
export const genuine = (g: PubGame): boolean => commitment(courseFelts(g.seed, g.song)).every((f, i) => f === g.courseCommit[i]);

/** True when `game` is this version's data with the course this app grows from its seed: the only records anyone can drive. */
export function playable(game: bigint[]): boolean {
  try {
    return genuine(decodeGame(game));
  } catch {
    return false;
  }
}

/** A random u32 seed for a new drive. */
export const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0];

/** The claim: the log's commitment is the note argument; the course and the log sit under their commitments. */
export function pubAnswer(seed: number, song: number, log: Event[], dist: number): GameAnswer {
  const course = courseFelts(seed, song), packed = packLog(log, dist).map(BigInt);
  const arg = commitment(packed);
  return { arg, advice: [[commitment(course), course], [arg, packed]] };
}
