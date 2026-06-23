import { describe, expect, it } from "vitest";
import { publicAppBaseUrl, publicAppUrl } from "./public-url";

function headers(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe("publicAppBaseUrl", () => {
  it("prefers configured PUBLIC_APP_URL", () => {
    expect(
      publicAppBaseUrl({
        headers: headers({ host: "attacker.example" }),
        env: { PUBLIC_APP_URL: "https://lottery.example.com/" }
      })
    ).toBe("https://lottery.example.com");
  });

  it("does not use request hosts in production without PUBLIC_APP_URL", () => {
    expect(
      publicAppBaseUrl({
        headers: headers({ host: "attacker.example" }),
        env: { NODE_ENV: "production" }
      })
    ).toBeNull();
  });

  it("allows local host fallback outside production", () => {
    expect(
      publicAppUrl("/campaigns/demo/lookup", {
        headers: headers({ host: "localhost:3000" }),
        env: { NODE_ENV: "development" }
      })
    ).toBe("http://localhost:3000/campaigns/demo/lookup");
  });
});
