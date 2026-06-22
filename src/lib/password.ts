import { scryptSync, timingSafeEqual } from "node:crypto";

type ScryptHash = {
  N: number;
  r: number;
  p: number;
  salt: string;
  key: string;
};

function parseHash(hash: string): ScryptHash | null {
  const [scheme, N, r, p, salt, key] = hash.split("$");
  if (scheme !== "scrypt" || !N || !r || !p || !salt || !key) {
    return null;
  }

  return {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    salt,
    key
  };
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parsed = parseHash(storedHash);
  if (!parsed) {
    return false;
  }

  const expected = Buffer.from(parsed.key, "base64url");
  const actual = scryptSync(password, parsed.salt, expected.length, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p
  });

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
