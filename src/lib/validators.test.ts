import { describe, expect, it } from "vitest";
import { appSettingsSchema } from "./validators";

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
      brandColor: "#A1b2C3"
    });

    expect(parsed.supportEmail).toBe("support@example.com");
    expect(parsed.logoUrl).toBe("https://example.com/logo.png");
    expect(parsed.brandColor).toBe("#A1b2C3");
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
});
