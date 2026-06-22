import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const password = process.argv[2];

if (!password) {
  console.error('Usage: npm run hash-password -- "your-password"');
  process.exit(1);
}

const params = { N: 16384, r: 8, p: 1 };
const salt = randomBytes(16).toString("base64url");
const key = scryptSync(password, salt, 64, params).toString("base64url");
const hash = `scrypt$${params.N}$${params.r}$${params.p}$${salt}$${key}`;

// Quick self-check to catch unsupported runtime behavior.
const candidate = scryptSync(password, salt, 64, params);
if (!timingSafeEqual(candidate, Buffer.from(key, "base64url"))) {
  console.error("Password hash self-check failed.");
  process.exit(1);
}

console.log(hash);
