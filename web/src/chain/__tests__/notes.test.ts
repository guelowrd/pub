import { describe, expect, it } from "vitest";
import { decodeStorage, encodeStorage, HEADER_ITEMS, isShotAt, randomWord, shotStorage, ZERO_WORD, type ChallengeStorage } from "../notes";

const record: ChallengeStorage = {
  expiryBlock: 1234,
  target: 2000,
  minStake: 1_000_000n,
  champion: { suffix: 11n, prefix: 22n },
  rival: null,
  recordId: ZERO_WORD,
  shotRoot: [1n, 2n, 3n, 4n],
  game: [7n, 0n, 0n, 0n, 3n, 1n, 0n, 0n, 9n, 9n, 9n, 9n],
  shotDeadline: 0,
};

describe("challenge storage (any game)", () => {
  it("is a 16-felt header followed by the game's own data, and round-trips", () => {
    const felts = encodeStorage(record);
    expect(felts).toHaveLength(HEADER_ITEMS + 12);
    expect(felts.slice(0, 8)).toEqual([11n, 22n, 2000n, 1_000_000n, 1234n, 0n, 0n, 0n]);
    expect(decodeStorage(felts)).toEqual(record);
    const other = { ...record, game: [1n, 2n, 3n, 4n] };
    expect(decodeStorage(encodeStorage(other))).toEqual(other);
    expect(() => encodeStorage({ ...record, game: [1n] })).toThrow(/whole words/);
  });

  it("derives a shot from a record and recognises it", () => {
    const recordId = [100n, 200n, 300n, 400n] as const;
    const shot = shotStorage(record, { suffix: 33n, prefix: 44n }, [...recordId], 1300);
    expect(encodeStorage(shot).slice(5, 8)).toEqual([33n, 44n, 1300n]);
    expect(isShotAt(shot, record, [...recordId])).toBe(true);
    expect(isShotAt({ ...shot, target: 1999 }, record, [...recordId])).toBe(false);
    expect(isShotAt(shot, record, [0n, 0n, 0n, 1n])).toBe(false);
    expect(isShotAt(record, record, [...recordId])).toBe(false);
  });

  it("random words are valid field elements", () => {
    for (const f of randomWord()) expect(f < 2n ** 63n).toBe(true);
  });
});
