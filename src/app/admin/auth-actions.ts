"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { clearSession, getSession, setSession } from "@/lib/session";
import { verifyPassword } from "@/lib/password";
import { checkRateLimit, hashRateLimitSubject, rateLimitSubjectFromHeaders } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

const adminLoginRateLimit = { limit: 5, windowSeconds: 10 * 60 };

function writeAuthAudit(action: string, metadata: Record<string, string>) {
  return prisma.auditLog.create({
    data: {
      action,
      entityType: "Auth",
      entityId: "admin",
      metadata: JSON.stringify(metadata)
    }
  });
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminEmail || !adminPasswordHash) {
    redirect("/admin/login?error=missing-config");
  }

  const requestHeaders = await headers();
  const rateLimitSubject = rateLimitSubjectFromHeaders(requestHeaders);
  // Gate on the current bucket without recording: only failed attempts count,
  // so a burst of attacker failures can't lock out the real admin's successes,
  // and the bucket is keyed per client (not per email) to avoid targeting.
  const loginRateLimit = await checkRateLimit({
    action: "admin_login",
    subject: rateLimitSubject,
    commit: false,
    ...adminLoginRateLimit
  });

  if (!loginRateLimit.allowed) {
    await writeAuthAudit("auth.login.rate_limited", { subjectHash: hashRateLimitSubject(rateLimitSubject) });
    redirect("/admin/login?error=invalid");
  }

  if (email !== adminEmail || !verifyPassword(password, adminPasswordHash)) {
    await checkRateLimit({
      action: "admin_login",
      subject: rateLimitSubject,
      ...adminLoginRateLimit
    });
    // Never log the submitted email verbatim — it is untrusted input.
    await writeAuthAudit("auth.login.failure", { subjectHash: hashRateLimitSubject(rateLimitSubject) });
    redirect("/admin/login?error=invalid");
  }

  await writeAuthAudit("auth.login.success", { admin: email });
  await setSession(email);
  redirect("/admin");
}

export async function logoutAction() {
  const session = await getSession();
  if (session) {
    await writeAuthAudit("auth.logout", { admin: session.email });
  }

  await clearSession();
  redirect("/admin/login");
}
