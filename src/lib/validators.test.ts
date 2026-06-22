import { describe, expect, it } from "vitest";
import { appSettingsSchema, ticketLookupSchema } from "./validators";

describe("appSettingsSchema", () => {
  it("normalizes optional empty fields to null", () => {
    const parsed = appSettingsSchema.parse({
      operatorName: " Example Operator ",
      publicTagline: " Campaigns and draws ",
      supportEmail: "",
      logoUrl: "",
      brandColor: "#3f6f5f"
    });

    expect(parsed).toEqual({
      operatorName: "Example Operator",
      publicTagline: "Campaigns and draws",
      supportEmail: null,
      logoUrl: null,
      brandColor: "#3f6f5f"
    });
  });

  it("accepts valid contact, logo, and color settings", () => {
    const parsed = appSettingsSchema.parse({
      operatorName: "Example Operator",
      publicTagline: "Transparent draws for participants.",
      supportEmail: "support@example.com",
      logoUrl: "https://example.com/logo.png",
      brandColor: "#2f5d50"
    });

    expect(parsed.supportEmail).toBe("support@example.com");
    expect(parsed.logoUrl).toBe("https://example.com/logo.png");
    expect(parsed.brandColor).toBe("#2f5d50");
  });

  it("rejects invalid email, logo protocol, and color values", () => {
    expect(
      appSettingsSchema.safeParse({
        operatorName: "Example Operator",
        publicTagline: "Transparent draws for participants.",
        supportEmail: "not-an-email",
        logoUrl: "ftp://example.com/logo.png",
        brandColor: "green"
      }).success
    ).toBe(false);
  });

  it("rejects light brand colors that do not contrast with white text", () => {
    expect(
      appSettingsSchema.safeParse({
        operatorName: "Example Operator",
        publicTagline: "Transparent draws for participants.",
        supportEmail: "",
        logoUrl: "",
        brandColor: "#ffffff"
      }).success
    ).toBe(false);
  });
});

describe("ticketLookupSchema", () => {
  it("normalizes lookup email and accepts an empty reference", () => {
    const parsed = ticketLookupSchema.parse({
      email: " USER@example.COM ",
      reference: ""
    });

    expect(parsed).toEqual({
      email: "user@example.com",
      reference: undefined
    });
  });

  it("rejects invalid lookup email", () => {
    expect(ticketLookupSchema.safeParse({ email: "not-an-email", reference: "" }).success).toBe(false);
  });
});
