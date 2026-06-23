import { describe, expect, it } from "vitest";
import { isSmtpConfigured, smtpConfigFromEnv } from "./email";

describe("smtpConfigFromEnv", () => {
  it("returns null when SMTP is not configured", () => {
    expect(smtpConfigFromEnv({})).toBeNull();
    expect(isSmtpConfigured({ SMTP_HOST: "smtp.example.com" })).toBe(false);
  });

  it("parses optional SMTP settings", () => {
    expect(
      smtpConfigFromEnv({
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "465",
        SMTP_SECURE: "true",
        SMTP_USER: "user",
        SMTP_PASSWORD: "secret",
        SMTP_FROM: "Lottery <no-reply@example.com>"
      })
    ).toEqual({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      user: "user",
      password: "secret",
      from: "Lottery <no-reply@example.com>"
    });
  });

  it("falls back to port 587", () => {
    expect(
      smtpConfigFromEnv({
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "invalid",
        SMTP_FROM: "no-reply@example.com"
      })?.port
    ).toBe(587);
  });
});
