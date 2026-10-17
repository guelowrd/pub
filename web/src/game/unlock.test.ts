import { describe, expect, it } from "vitest";
import { need, unlocked } from "./unlock";

describe("track locks", () => {
  it("leaves the first five open", () => { for (let i = 0; i < 5; i++) { expect(need(i)).toBeNull(); expect(unlocked(i, [])).toBe(true); } });
  it("asks one record at 1000 for track 6, eight at 8000 for track 13", () => { expect(need(5)).toEqual({ records: 1, score: 1000 }); expect(need(12)).toEqual({ records: 8, score: 8000 }); });
  it("counts records and the best score separately", () => {
    expect(unlocked(5, [])).toBe(false);
    expect(unlocked(5, [999])).toBe(false);
    expect(unlocked(5, [1000])).toBe(true); // at or above
    expect(unlocked(6, [2500])).toBe(false); // one record is not two
    expect(unlocked(6, [2500, 10])).toBe(true);
    expect(unlocked(12, [8000, 1, 1, 1, 1, 1, 1])).toBe(false);
    expect(unlocked(12, [8000, 1, 1, 1, 1, 1, 1, 1])).toBe(true);
  });
});
