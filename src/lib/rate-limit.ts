import { createHmac } from "node:crypto";
import { prisma } from "./prisma";

type HeaderReader = Pick<Headers, "get">;

export type RateLimitResult =
  | { allowed: true; retryAfterSeconds: 0 }
  | { allowed: false; retryAfterSeconds: number };

type RateLimitOptions = {
  action: string;
  subject: string;
  limit: number;
  windowSeconds: number;
  now?: Date;
  // When false, only check the bucket without recording a hit. Callers use
  // this to gate first and commit only failed attempts (e.g. admin login), so
  // legitimate successes never consume the budget.
  commit?: boolean;
};

function getRateLimitSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("AUTH_SECRET must be set to a random value with at least 24 characters.");
  }

  return secret;
}

function firstForwardedIp(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

export function trustProxyHeaders(value = process.env.TRUST_PROXY_HEADERS): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

export function getClientIpFromHeaders(headers: HeaderReader): string {
  const forwardedFor = firstForwardedIp(headers.get("x-forwarded-for"));
  if (forwardedFor) {
    return forwardedFor;
  }

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  const cloudflareIp = headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) {
    return cloudflareIp;
  }

  return "unknown";
}

export function rateLimitSubjectFromHeaders(headers: HeaderReader, fallbackSubject = "direct-client"): string {
  return trustProxyHeaders() ? getClientIpFromHeaders(headers) : fallbackSubject;
}

export function hashRateLimitSubject(subject: string, secret = getRateLimitSecret()): string {
  return createHmac("sha256", secret).update(subject).digest("base64url");
}

export function isHoneypotFilled(formData: FormData, fieldName = "website"): boolean {
  return String(formData.get(fieldName) ?? "").trim().length > 0;
}

export async function checkRateLimit({
  action,
  subject,
  limit,
  windowSeconds,
  now = new Date(),
  commit = true
}: RateLimitOptions): Promise<RateLimitResult> {
  const subjectHash = hashRateLimitSubject(`${action}:${subject}`);
  const key = `${action}:${subjectHash}`;
  const windowMs = windowSeconds * 1000;
  const expiresAt = new Date(now.getTime() + windowMs);

  if (commit) {
    // Atomic path: a single conditional increment admits the request only while
    // the live window is under the limit — no check-then-act race.
    const incremented = await prisma.rateLimitBucket.updateMany({
      where: { key, expiresAt: { gt: now }, count: { lt: limit } },
      data: { count: { increment: 1 } }
    });

    if (incremented.count === 1) {
      return { allowed: true, retryAfterSeconds: 0 };
    }
  }

  const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } });

  if (bucket && bucket.expiresAt > now) {
    // Bucket exists and is live; the conditional increment above either already
    // admitted this request or the window is full.
    if (bucket.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt.getTime() - now.getTime()) / 1000))
      };
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (!commit) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // No live bucket: start a fresh window.
  await prisma.rateLimitBucket.upsert({
    where: { key },
    create: {
      key,
      subjectHash,
      action,
      count: 1,
      windowStart: now,
      expiresAt
    },
    update: {
      subjectHash,
      action,
      count: 1,
      windowStart: now,
      expiresAt
    }
  });

  return { allowed: true, retryAfterSeconds: 0 };
}
