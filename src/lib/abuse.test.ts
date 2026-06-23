import { describe, expect, it } from "vitest";
import { detectEntryRisk, isApprovedForDraw, normalizeReviewStatus, reviewStatusForRiskFlags } from "./abuse";

describe("entry abuse review helpers", () => {
  it("flags disposable email domains", () => {
    const flags = detectEntryRisk({ email: "person@mailinator.com" });

    expect(flags).toContain("disposable_email_domain");
    expect(reviewStatusForRiskFlags(flags)).toBe("FLAGGED");
  });

  it("defaults unknown review statuses to approved for compatibility", () => {
    expect(normalizeReviewStatus("UNKNOWN")).toBe("APPROVED");
  });

  it("excludes flagged and ineligible entries from draws", () => {
    expect(isApprovedForDraw({ isEligible: true, reviewStatus: "APPROVED" })).toBe(true);
    expect(isApprovedForDraw({ isEligible: true, reviewStatus: "FLAGGED" })).toBe(false);
    expect(isApprovedForDraw({ isEligible: false, reviewStatus: "APPROVED" })).toBe(false);
  });
});
