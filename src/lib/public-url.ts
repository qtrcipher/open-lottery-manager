type HeaderReader = Pick<Headers, "get">;

function cleanBaseUrl(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function publicAppBaseUrl({
  headers,
  env = process.env
}: {
  headers: HeaderReader;
  env?: NodeJS.ProcessEnv;
}): string | null {
  const configured = env.PUBLIC_APP_URL?.trim();
  if (configured) {
    return cleanBaseUrl(configured);
  }

  if (env.NODE_ENV === "production") {
    return null;
  }

  const host = headers.get("host")?.trim() || "localhost:3000";
  return cleanBaseUrl(`http://${host}`);
}

export function publicAppUrl(path: string, options: { headers: HeaderReader; env?: NodeJS.ProcessEnv }): string | null {
  const baseUrl = publicAppBaseUrl(options);
  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
