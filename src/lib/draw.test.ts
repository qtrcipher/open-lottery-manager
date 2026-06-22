import { describe, expect, it } from "vitest";
import { createSeedHash, selectWinners } from "./draw";

const entries = [
  { id: "entry-1", isEligible: true },
  { id: "entry-2", isEligible: true },
  { id: "entry-3", isEligible: true },
  { id: "entry-4", isEligible: false }
];

const prizes = [
  { id: "second", quantity: 1, sortOrder: 2 },
  { id: "first", quantity: 2, sortOrder: 1 }
];

describe("selectWinners", () => {
  it("selects deterministic winners for the same seed", () => {
    const first = selectWinners(entries, prizes, "fixed-seed");
    const second = selectWinners(entries, prizes, "fixed-seed");

    expect(second).toEqual(first);
    expect(first.seedHash).toBe(createSeedHash("fixed-seed"));
  });

  it("assigns prizes by sort order and never selects ineligible entries", () => {
    const result = selectWinners(entries, prizes, "fixed-seed");

    expect(result.winners).toHaveLength(3);
    expect(result.winners.map((winner) => winner.prizeId)).toEqual(["first", "first", "second"]);
    expect(result.winners.map((winner) => winner.entryId)).not.toContain("entry-4");
    expect(new Set(result.winners.map((winner) => winner.entryId)).size).toBe(result.winners.length);
  });

  it("records only available winners when prize slots exceed eligible entries", () => {
    const result = selectWinners(entries.slice(0, 2), prizes, "fixed-seed");

    expect(result.winners).toHaveLength(2);
  });
});
