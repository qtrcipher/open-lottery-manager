export type TurnstileVerificationResult = {
  ok: boolean;
  skipped: boolean;
  error?: string;
};

export function isTurnstileConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY?.trim());
}

export async function verifyTurnstileToken({
  token,
  remoteIp,
  env = process.env,
  fetchImpl = fetch
}: {
  token?: string;
  remoteIp?: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}): Promise<TurnstileVerificationResult> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();

  if (!secret) {
    return { ok: true, skipped: true };
  }

  if (!token) {
    return { ok: false, skipped: false, error: "Missing Turnstile response." };
  }

  const body = new URLSearchParams({
    secret,
    response: token
  });

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body
  });

  if (!response.ok) {
    return { ok: false, skipped: false, error: "Turnstile verification request failed." };
  }

  const payload = (await response.json()) as { success?: boolean; "error-codes"?: string[] };

  return {
    ok: payload.success === true,
    skipped: false,
    error: payload.success === true ? undefined : payload["error-codes"]?.join(", ") || "Turnstile verification failed."
  };
}
