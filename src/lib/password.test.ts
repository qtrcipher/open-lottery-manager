import { describe, expect, it } from "vitest";
import { verifyPassword } from "./password";

describe("verifyPassword", () => {
  it("accepts a matching scrypt hash and rejects non-matching input", () => {
    const hash =
      "scrypt$16384$8$1$test-salt$GGp03_CxrK_udF3Hk_SoGBXB7i1a9TccbmpPi9Fp5ZEUZUbLNqHf7fZLCibf642XtkU6D9zcRsiAWpMN-6_4qA";

    expect(verifyPassword("correct-password", hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });
});
