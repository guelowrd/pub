// The web app's game data and claim must hash exactly as integration/src/game.rs (and the MASM) do: the first vector's
// commitments were printed by `cargo test -p integration --lib print_vector_commitments -- --nocapture`.
import { describe, expect, it } from "vitest";
import vectors from "../../../../rules/vectors.json";
import { Word } from "@miden-sdk/miden-sdk";
import { commitment, courseFelts, decodeGame, encodeGame, genuine, newGame, pubAnswer, RULES_VERSION } from "../game";
import { wordFromFelts } from "../chain";
import type { Event } from "../../game/sim";

const run = vectors.runs[0];
const COURSE_COMMIT = "0xc8f44871eb5535dd791b8c5c362b23ee1671c41361869d9c669f853f1f453503";
const LOG_COMMIT = "0xc8dcf7c6687306a70a9576bed4c5c3b53531200e43803daf641526109e8965fe";
const hex = (w: bigint[]) => wordFromFelts(w as [bigint, bigint, bigint, bigint]).toHex();

describe("Pick Up Boomers game data", () => {
  it("grows the vector's course from its seed and commits to it like the Rust side", () => {
    expect(courseFelts(run.seed, run.song).map(Number)).toEqual(run.course);
    expect(hex(commitment(run.course.map(BigInt)))).toBe(COURSE_COMMIT);
    expect(Word.fromHex(COURSE_COMMIT).toFelts().map((f) => f.asInt())).toEqual(commitment(run.course.map(BigInt)));
  });

  it("the claim: the log under its commitment (the note argument) and the course under its own", () => {
    const answer = pubAnswer(run.seed, run.song, run.log as Event[], run.dist);
    expect(hex(answer.arg)).toBe(LOG_COMMIT);
    expect(answer.advice.map(([k, v]) => [hex(k), v.length])).toEqual([[COURSE_COMMIT, 224], [LOG_COMMIT, run.events.length + 2]]);
    expect(answer.advice[1][1].slice(0, 2)).toEqual([BigInt(run.events.length), BigInt(run.dist)]);
  });

  it("is seed, song and version in the first two words, then the course commitment, and only that", () => {
    const g = newGame(run.seed, 3);
    const felts = encodeGame(g);
    expect(felts).toHaveLength(12);
    expect(felts.slice(0, 8)).toEqual([BigInt(run.seed), 0n, 0n, 0n, 3n, RULES_VERSION, 0n, 0n]);
    expect(decodeGame(felts)).toEqual(g);
    expect(genuine(g)).toBe(true);
    expect(genuine({ ...g, seed: run.seed + 1 })).toBe(false);
    expect(() => decodeGame(felts.slice(0, 8))).toThrow(/not Pick Up Boomers/);
    expect(() => decodeGame([...felts.slice(0, 5), 1n, ...felts.slice(6)])).toThrow(/not Pick Up Boomers/);
    expect(() => decodeGame([...felts.slice(0, 4), 999n, ...felts.slice(5)])).toThrow(/not Pick Up Boomers/);
  });
});