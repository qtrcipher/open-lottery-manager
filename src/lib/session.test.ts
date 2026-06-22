import { describe, expect, it } from "vitest";
import { createSessionToken, readSessionToken } from "./session";

describe("session tokens", () => {
  it("round-trips signed session tokens and rejects tampering", () => {
    process.env.AUTH_SECRET = "test-secret-with-enough-length";
    const token = createSessionToken("admin@example.com");

    expect(readSessionToken(token)).toEqual({ email: "admin@example.com" });
    expect(readSessionToken(`${token}tampered`)).toBeNull();
  });
});
