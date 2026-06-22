import { describe, expect, it } from "vitest";
import { getClientIpFromHeaders, hashRateLimitSubject, isHoneypotFilled } from "./rate-limit";

describe("getClientIpFromHeaders", () => {
  it("uses the first forwarded IP address", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10, 198.51.100.2",
      "x-real-ip": "198.51.100.9"
    });

    expect(getClientIpFromHeaders(headers)).toBe("203.0.113.10");
  });

  it("falls back to real IP and then unknown", () => {
    expect(getClientIpFromHeaders(new Headers({ "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
    expect(getClientIpFromHeaders(new Headers())).toBe("unknown");
  });
});

describe("hashRateLimitSubject", () => {
  it("creates stable hashes without exposing the raw subject", () => {
    const subject = "public_entry:campaign:203.0.113.10";
    const secret = "test-secret-with-enough-length";

    expect(hashRateLimitSubject(subject, secret)).toBe(hashRateLimitSubject(subject, secret));
    expect(hashRateLimitSubject(subject, secret)).not.toContain("203.0.113.10");
    expect(hashRateLimitSubject(subject, "different-secret-with-enough-length")).not.toBe(hashRateLimitSubject(subject, secret));
  });
});

describe("isHoneypotFilled", () => {
  it("detects hidden field submissions", () => {
    const clean = new FormData();
    clean.set("website", "");

    const trapped = new FormData();
    trapped.set("website", "https://spam.example");

    expect(isHoneypotFilled(clean)).toBe(false);
    expect(isHoneypotFilled(trapped)).toBe(true);
  });
});
