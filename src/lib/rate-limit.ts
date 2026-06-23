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
  now = new Date()
}: RateLimitOptions): Promise<RateLimitResult> {
  const subjectHash = hashRateLimitSubject(`${action}:${subject}`);
  const key = `${action}:${subjectHash}`;
  const windowMs = windowSeconds * 1000;
  const expiresAt = new Date(now.getTime() + windowMs);

  const bucket = await prisma.rateLimitBucket.findUnique({ where: { key } });
  if (!bucket || bucket.expiresAt <= now) {
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

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt.getTime() - now.getTime()) / 1000))
    };
  }

  await prisma.rateLimitBucket.update({
    where: { key },
    data: { count: { increment: 1 } }
  });

  return { allowed: true, retryAfterSeconds: 0 };
}
