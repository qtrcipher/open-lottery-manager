import { describe, expect, it } from "vitest";
import { verifyPassword } from "./password";

describe("verifyPassword", () => {
  it("accepts a matching scrypt hash and rejects non-matching input", () => {
    const hash =
      "scrypt$16384$8$1$test-salt$GGp03_CxrK_udF3Hk_SoGBXB7i1a9TccbmpPi9Fp5ZEUZUbLNqHf7fZLCibf642XtkU6D9zcRsiAWpMN-6_4qA";

    expect(verifyPassword("correct-password", hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("accepts the colon-separated format that survives dotenv expansion", () => {
    const hash =
      "scrypt:16384:8:1:test-salt:4I_iVtTV8wziqv9ZLN82jKzxxDcHzep4XrnTVL1b84PTH14zF_dhgYg3QnJZO0C1c18oM_POiQNYF9dtNUOpGg";

    expect(verifyPassword("colon-password", hash)).toBe(true);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("rejects malformed hashes without throwing", () => {
    expect(verifyPassword("any", "not-a-hash")).toBe(false);
    expect(verifyPassword("any", "scrypt:16384:8:1:only-five")).toBe(false);
    expect(verifyPassword("any", "")).toBe(false);
  });
});
