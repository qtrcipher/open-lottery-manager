"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { clearSession, setSession } from "@/lib/session";
import { verifyPassword } from "@/lib/password";
import { checkRateLimit, rateLimitSubjectFromHeaders } from "@/lib/rate-limit";

const adminLoginRateLimit = { limit: 5, windowSeconds: 10 * 60 };

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!adminEmail || !adminPasswordHash) {
    redirect("/admin/login?error=missing-config");
  }

  const requestHeaders = await headers();
  const loginRateLimit = await checkRateLimit({
    action: "admin_login",
    subject: `${email || "unknown"}:${rateLimitSubjectFromHeaders(requestHeaders)}`,
    ...adminLoginRateLimit
  });

  if (!loginRateLimit.allowed) {
    redirect("/admin/login?error=invalid");
  }

  if (email !== adminEmail || !verifyPassword(password, adminPasswordHash)) {
    redirect("/admin/login?error=invalid");
  }

  await setSession(email);
  redirect("/admin");
}

export async function logoutAction() {
  await clearSession();
  redirect("/admin/login");
}
