import { describe, expect, it, vi } from "vitest";
import { isTurnstileConfigured, verifyTurnstileToken } from "./turnstile";

describe("verifyTurnstileToken", () => {
  it("skips verification when no secret is configured", async () => {
    await expect(verifyTurnstileToken({ env: {} })).resolves.toEqual({ ok: true, skipped: true });
    expect(isTurnstileConfigured({})).toBe(false);
  });

  it("fails closed when only the site key is configured", async () => {
    const result = await verifyTurnstileToken({
      token: "token",
      env: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key" }
    });

    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.error).toMatch(/misconfigured/);
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
