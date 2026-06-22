import { describe, expect, it } from "vitest";
import { createDrawVerificationSummary } from "./draw-verification";

describe("createDrawVerificationSummary", () => {
  it("counts total and eligible entries", () => {
    const summary = createDrawVerificationSummary(
      [{ isEligible: true }, { isEligible: false }, { isEligible: true }],
      []
    );

    expect(summary.totalEntryCount).toBe(3);
    expect(summary.eligibleEntryCount).toBe(2);
  });

  it("sets winner count from ordered winner rows", () => {
    const summary = createDrawVerificationSummary(
      [{ isEligible: true }],
      [
        {
          rank: 1,
          prize: { name: "Grand Prize" },
          entry: { name: "Amina Hassan", ticketCode: "TKT-1" }
        }
      ]
    );

    expect(summary.winnerCount).toBe(summary.winners.length);
  });

  it("preserves winner rank order in the summary", () => {
    const summary = createDrawVerificationSummary(
      [{ isEligible: true }, { isEligible: true }],
      [
        {
          rank: 2,
          prize: { name: "Second Prize" },
          entry: { name: "Omar Ali", ticketCode: "TKT-2" }
        },
        {
          rank: 1,
          prize: { name: "First Prize" },
          entry: { name: "Fatima Noor", ticketCode: "TKT-1" }
        }
      ]
    );

    expect(summary.winners).toEqual([
      {
        rank: 1,
        prizeName: "First Prize",
        participantName: "Fatima Noor",
        ticketCode: "TKT-1"
      },
      {
        rank: 2,
        prizeName: "Second Prize",
        participantName: "Omar Ali",
        ticketCode: "TKT-2"
      }
    ]);
  });
});
