import { createHmac, timingSafeEqual } from "node:crypto";

// Lookup results are only revealed after the rate-limited, email-gated
// lookupTicketAction succeeds. The action signs the result so the lookup page
// cannot be used as an unauthenticated ticket-status oracle.
const LOOKUP_TOKEN_TTL_MS = 10 * 60 * 1000;

function getLookupTokenSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("AUTH_SECRET must be set to a random value with at least 24 characters.");
  }

  return secret;
}

function signLookupPayload(payload: string, secret = getLookupTokenSecret()): string {
  return createHmac("sha256", secret).update(`ticket-lookup:${payload}`).digest("base64url");
}

export function createLookupToken(
  { campaignId, ticketCode }: { campaignId: string; ticketCode: string },
  now: number = Date.now()
): string {
  const expiresAt = now + LOOKUP_TOKEN_TTL_MS;
  const signature = signLookupPayload(`${campaignId}:${ticketCode}:${expiresAt}`);

  return `${expiresAt}.${signature}`;
}

export function verifyLookupToken(
  { campaignId, ticketCode, token }: { campaignId: string; ticketCode: string; token?: string },
  now: number = Date.now()
): boolean {
  if (!token) {
    return false;
  }

  const separator = token.indexOf(".");
  if (separator <= 0) {
    return false;
  }

  const expiresAt = Number(token.slice(0, separator));
  const signature = token.slice(separator + 1);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || !signature) {
    return false;
  }

  const expected = Buffer.from(signLookupPayload(`${campaignId}:${ticketCode}:${expiresAt}`));
  const provided = Buffer.from(signature);

  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
