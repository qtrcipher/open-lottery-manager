import { describe, expect, it, vi } from "vitest";
import { isTurnstileConfigured, verifyTurnstileToken } from "./turnstile";

describe("verifyTurnstileToken", () => {
  it("skips verification when no secret is configured", async () => {
    await expect(verifyTurnstileToken({ env: {} })).resolves.toEqual({ ok: true, skipped: true });
    expect(isTurnstileConfigured({})).toBe(false);
  });

  it("rejects missing tokens when a secret is configured", async () => {
    await expect(verifyTurnstileToken({ env: { TURNSTILE_SECRET_KEY: "secret" } })).resolves.toMatchObject({
      ok: false,
      skipped: false
    });
  });

  it("passes successful verification responses", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));

    await expect(
      verifyTurnstileToken({
        token: "token",
        env: { TURNSTILE_SECRET_KEY: "secret" },
        fetchImpl
      })
    ).resolves.toMatchObject({ ok: true, skipped: false });
  });
});
