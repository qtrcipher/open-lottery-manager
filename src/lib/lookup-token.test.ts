import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLookupToken, verifyLookupToken } from "./lookup-token";

const SECRET = "test-secret-with-enough-length";

describe("lookup tokens", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
  });

  it("verifies a freshly created token", () => {
    const now = Date.now();
    const token = createLookupToken({ campaignId: "c1", ticketCode: "TKT-ABC123" }, now);

    expect(verifyLookupToken({ campaignId: "c1", ticketCode: "TKT-ABC123", token }, now)).toBe(true);
  });

  it("rejects a missing or malformed token", () => {
    expect(verifyLookupToken({ campaignId: "c1", ticketCode: "TKT-ABC123" })).toBe(false);
    expect(verifyLookupToken({ campaignId: "c1", ticketCode: "TKT-ABC123", token: "not-a-token" })).toBe(false);
    expect(verifyLookupToken({ campaignId: "c1", ticketCode: "TKT-ABC123", token: ".sig" })).toBe(false);
  });

  it("rejects a token for a different ticket or campaign", () => {
    const token = createLookupToken({ campaignId: "c1", ticketCode: "TKT-ABC123" });

    expect(verifyLookupToken({ campaignId: "c1", ticketCode: "TKT-OTHER99", token })).toBe(false);
    expect(verifyLookupToken({ campaignId: "c2", ticketCode: "TKT-ABC123", token })).toBe(false);
  });

  it("rejects an expired token", () => {
    const now = Date.now();
    const token = createLookupToken({ campaignId: "c1", ticketCode: "TKT-ABC123" }, now);

    expect(verifyLookupToken({ campaignId: "c1", ticketCode: "TKT-ABC123", token }, now + 11 * 60 * 1000)).toBe(false);
  });

  it("fails closed when AUTH_SECRET is missing", () => {
    delete process.env.AUTH_SECRET;

    expect(() => createLookupToken({ campaignId: "c1", ticketCode: "TKT-ABC123" })).toThrow(/AUTH_SECRET/);
  });
});
