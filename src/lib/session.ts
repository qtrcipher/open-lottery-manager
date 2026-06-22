import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const cookieName = "olm_session";
const sessionTtlSeconds = 60 * 60 * 8;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("AUTH_SECRET must be set to a random value with at least 24 characters.");
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function isValidSignature(value: string, signature: string): boolean {
  const expected = Buffer.from(sign(value));
  const actual = Buffer.from(signature);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessionToken(email: string): string {
  const payload = JSON.stringify({
    email,
    nonce: randomBytes(16).toString("base64url"),
    expiresAt: Date.now() + sessionTtlSeconds * 1000
  });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function readSessionToken(token?: string): { email: string } | null {
  if (!token) {
    return null;
  }

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !isValidSignature(encoded, signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      email?: string;
      expiresAt?: number;
    };

    if (!payload.email || !payload.expiresAt || payload.expiresAt < Date.now()) {
      return null;
    }

    return { email: payload.email };
  } catch {
    return null;
  }
}

export async function setSession(email: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, createSessionToken(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionTtlSeconds,
    path: "/"
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function getSession(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  return readSessionToken(cookieStore.get(cookieName)?.value);
}

export async function requireAdmin(): Promise<{ email: string }> {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}
