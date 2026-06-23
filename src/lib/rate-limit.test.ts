import { describe, expect, it } from "vitest";
import { getClientIpFromHeaders, hashRateLimitSubject, isHoneypotFilled, rateLimitSubjectFromHeaders, trustProxyHeaders } from "./rate-limit";

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

describe("rateLimitSubjectFromHeaders", () => {
  it("does not trust forwarded headers by default", () => {
    process.env.TRUST_PROXY_HEADERS = "";
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10"
    });

    expect(trustProxyHeaders()).toBe(false);
    expect(rateLimitSubjectFromHeaders(headers)).toBe("direct-client");
  });

  it("uses forwarded headers when trust is explicitly enabled", () => {
    process.env.TRUST_PROXY_HEADERS = "true";
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.10, 198.51.100.2"
    });

    expect(trustProxyHeaders()).toBe(true);
    expect(rateLimitSubjectFromHeaders(headers)).toBe("203.0.113.10");
    process.env.TRUST_PROXY_HEADERS = "";
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
